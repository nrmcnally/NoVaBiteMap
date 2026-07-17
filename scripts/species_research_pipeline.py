"""Normalize BiteMap deep species research archives into deterministic artifacts.

The pipeline deliberately does not update the production scoring profiles. It
preserves provenance, normalizes batch schema drift, deduplicates sources, and
creates a queue for the separate scientific model-translation review.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import posixpath
import re
import sys
import tempfile
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zipfile import BadZipFile, ZipFile


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARCHIVE_DIR = ROOT / "research" / "species" / "raw" / "archives"
DEFAULT_OUTPUT_DIR = ROOT / "research" / "species" / "generated"
DEFAULT_OVERRIDE_FILE = (
    ROOT / "research" / "species" / "config" / "source-overrides.json"
)
DEFAULT_EXPECTED_SPECIES_FILE = (
    ROOT / "research" / "species" / "config" / "expected-species.json"
)

SCHEMA_VERSION = "0.1.0-draft"
PIPELINE_VERSION = "0.1.0"

TOPIC_KEYS = (
    "thermal",
    "dissolvedOxygen",
    "diel",
    "reproduction",
    "flow",
    "turbidity",
    "tidalSalinity",
    "weather",
    "fishingPressure",
    "monthlyRegionalActivity",
)

ALLOWED_MODEL_USES = {"score", "context-only", "zero-weight", "unavailable"}


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slug(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "unknown"


def compact(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", slug(value))


def clean_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_year(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    match = re.fullmatch(r"\s*(\d{4})\s*", str(value))
    return int(match.group(1)) if match else None


def normalize_doi(value: Any) -> str | None:
    text = clean_string(value)
    if not text:
        return None
    text = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", text, flags=re.I)
    text = re.sub(r"^doi:\s*", "", text, flags=re.I).strip().lower()
    return text or None


def normalize_url(value: Any) -> str | None:
    text = clean_string(value)
    if not text:
        return None
    try:
        parsed = urlsplit(text)
    except ValueError:
        return text
    if not parsed.scheme or not parsed.netloc:
        return text
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))
    path = parsed.path.rstrip("/") or "/"
    return urlunsplit(
        (parsed.scheme.lower(), parsed.netloc.lower(), path, query, "")
    )


def normalize_model_use(value: Any) -> str:
    text = slug(value)
    aliases = {
        "context": "context-only",
        "contextual": "context-only",
        "zero": "zero-weight",
        "reject": "zero-weight",
        "rejected": "zero-weight",
        "not-available": "unavailable",
    }
    normalized = aliases.get(text, text)
    return normalized if normalized in ALLOWED_MODEL_USES else "unavailable"


def normalize_research_status(value: Any) -> str:
    text = slug(value)
    if text in {"complete", "completed"}:
        return "complete"
    if text in {"partial", "in-progress", "complete-for-batch"}:
        return "partial"
    if text in {"insufficient", "insufficient-evidence"}:
        return "insufficient"
    return "unknown"


def normalize_current_status(value: Any) -> str:
    text = slug(value)
    if text in {"current", "bite-scored", "scored"}:
        return "current"
    if text in {"proposed", "proposed-for-bite-scoring"}:
        return "proposed"
    if text in {"guide-only", "fish-guide-only"}:
        return "guide-only"
    return "unknown"


def normalize_recommendation(value: Any) -> str:
    text = slug(value)
    if not text or text == "unknown":
        return "unknown"
    if "proposed" in text:
        return "proposed-for-bite-scoring"
    if "guide" in text:
        return "fish-guide-only"
    if "insufficient" in text:
        return "insufficient-evidence"
    if "bite" in text or text in {"current", "score", "scored"}:
        return "bite-scored"
    return "unknown"


def recommendation_from_record(record: dict[str, Any]) -> str:
    candidates: list[Any] = [record.get("promotionRecommendation")]
    targetability = record.get("targetabilityAssessment")
    if isinstance(targetability, dict):
        candidates.extend(
            [
                targetability.get("promotionRecommendation"),
                targetability.get("targetabilityRecommendation"),
            ]
        )
    verdict = record.get("finalVerdict")
    if isinstance(verdict, dict):
        candidates.extend(
            [
                verdict.get("promotionRecommendation"),
                verdict.get("targetabilityRecommendation"),
            ]
        )
    for candidate in candidates:
        normalized = normalize_recommendation(candidate)
        if normalized != "unknown":
            return normalized
    if isinstance(verdict, dict):
        safe_to_implement = verdict.get("safeToImplement")
        if isinstance(safe_to_implement, list) and any(
            isinstance(item, dict)
            and normalize_model_use(item.get("recommendedModelUse")) == "score"
            for item in safe_to_implement
        ):
            return "bite-scored"
    return "unknown"


def endpoint_category(evidence: dict[str, Any]) -> str:
    measured = " ".join(
        str(evidence.get(key) or "")
        for key in ("whatWasMeasured", "evidenceType", "variable")
    ).lower()
    observed = str(evidence.get("observedEffect") or "").lower()
    if re.search(r"evidence[- ]?gap|documented research gap|systematic review", measured):
        if re.search(
            r"\bno (?:qualifying|direct|defensible|verified)\b|"
            r"\bnot (?:located|found|verified|available)\b|"
            r"\bwas not (?:located|found|verified)\b",
            observed,
        ):
            return "evidence-gap"
    if re.search(r"hook|angl|catch|capture rate|creel|tag return|recapture", measured):
        return "hook-and-line-catchability"
    if re.search(
        r"feed|forag|prey|diet|stomach|gut content|consumption|attack rate|handling time",
        measured,
    ):
        return "feeding-or-foraging"
    if re.search(r"spawn|nest|reproduct|parental|migration", measured):
        return "reproduction-or-migration"
    if re.search(r"movement|telemetry|activity|space use|home range", measured):
        return "movement-or-general-activity"
    if re.search(r"habitat|occupancy|distribution|microhabitat|abundance", measured):
        return "habitat-or-population"
    if re.search(
        r"growth|survival|mortality|metabol|respiration|condition|stress|oxygen consumption",
        measured,
    ):
        return "growth-physiology-or-survival"
    if re.search(r"taxonom|identity|nomenclature", measured):
        return "taxonomy"
    return "other-or-context"


def runtime_input(input_value: Any) -> dict[str, str]:
    text = compact(input_value)
    if re.search(r"fish(length|totallength|age|size)|bodylength", text):
        return {
            "inputKey": "fish-size-or-age",
            "availability": "unavailable",
            "forecastResolution": "not-forecastable",
        }
    if (
        "populationorstrain" in text
        or "hybrididentity" in text
        or text in {"strain", "population"}
    ):
        return {
            "inputKey": "population-or-strain",
            "availability": "unavailable",
            "forecastResolution": "static-unavailable",
        }
    if re.search(r"recentstocking|dayssincestocking|isstockingday|stockingrecency", text):
        return {
            "inputKey": "recent-stocking-event",
            "availability": "unavailable",
            "forecastResolution": "not-currently-ingested",
        }
    if re.search(r"recentangling|recentcapture|socialexposure|fishingpressure", text):
        return {
            "inputKey": "recent-angling-or-capture-history",
            "availability": "unavailable",
            "forecastResolution": "not-forecastable",
        }
    if "artificiallight" in text:
        return {
            "inputKey": "local-artificial-light",
            "availability": "unavailable",
            "forecastResolution": "not-forecastable",
        }
    if re.search(r"reproduct|spawn|nestguard", text):
        return {
            "inputKey": "reproductive-phase",
            "availability": "modeled",
            "forecastResolution": "daily",
        }
    if re.search(r"dissolvedoxygen|oxygenmgl|oxygen", text):
        return {
            "inputKey": "dissolved-oxygen",
            "availability": "conditional",
            "forecastResolution": "observed-only",
        }
    if re.search(r"tidal|tide", text):
        return {
            "inputKey": "tidal-stage",
            "availability": "conditional",
            "forecastResolution": "hourly",
        }
    if re.search(r"suspendedsediment|turbidity|clarity", text):
        return {
            "inputKey": "turbidity-or-suspended-sediment",
            "availability": "conditional",
            "forecastResolution": "observed-or-hourly",
        }
    if re.search(r"streamflow|flow|current", text):
        return {
            "inputKey": "flow-or-current",
            "availability": "conditional",
            "forecastResolution": "observed-or-hourly",
        }
    if "lunar" in text or "moon" in text:
        return {
            "inputKey": "lunar-phase",
            "availability": "available",
            "forecastResolution": "daily",
        }
    if re.search(r"timeofday|diel|underwaterlight|solarradiation|daylight", text):
        return {
            "inputKey": "light-and-diel",
            "availability": "available",
            "forecastResolution": "hourly",
        }
    if re.search(r"watertemperature|temperature|extremeheat|coldwater|warmwater", text):
        return {
            "inputKey": "water-temperature",
            "availability": "modeled",
            "forecastResolution": "hourly-and-daily",
        }
    if re.search(r"prey|forage", text):
        return {
            "inputKey": "prey-availability",
            "availability": "unavailable",
            "forecastResolution": "not-forecastable",
        }
    return {
        "inputKey": slug(input_value),
        "availability": "unknown",
        "forecastResolution": "unknown",
    }


def generic_url_reason(url: str | None) -> str | None:
    if not url:
        return "missing-url"
    try:
        parsed = urlsplit(url)
    except ValueError:
        return "invalid-url"
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return "invalid-url"
    path = parsed.path.rstrip("/")
    if not path:
        return "site-homepage-not-source-record"
    if parsed.netloc.lower().endswith("seafwa.org") and path in {
        "/journal",
        "/proceedings",
    }:
        return "search-or-listing-page-not-source-record"
    return None


def canonical_source_key(source: dict[str, Any]) -> str:
    doi = normalize_doi(source.get("doi"))
    if doi:
        return f"doi:{doi}"
    normalized_url = normalize_url(source.get("url"))
    if normalized_url:
        parsed = urlsplit(normalized_url)
        if parsed.netloc in {"doi.org", "dx.doi.org"}:
            return f"doi:{normalize_doi(parsed.path.lstrip('/'))}"
        return f"url:{normalized_url}"
    identity = "|".join(
        [
            slug(source.get("title")),
            str(normalize_year(source.get("year")) or ""),
            slug(source.get("authorsOrAgency")),
        ]
    )
    return f"metadata:{identity}"


def canonical_source_id(source: dict[str, Any]) -> str:
    digest = hashlib.sha256(canonical_source_key(source).encode("utf-8")).hexdigest()
    return f"src-{digest[:16]}"


def verification_for_source(
    source: dict[str, Any],
    archive_validation: dict[str, Any],
    species_id: str,
    source_id: str,
) -> dict[str, Any]:
    embedded = source.get("verification")
    if isinstance(embedded, dict):
        return copy.deepcopy(embedded)
    verification_rows = archive_validation.get("sourceVerification")
    if isinstance(verification_rows, list):
        for row in verification_rows:
            if (
                isinstance(row, dict)
                and row.get("speciesId") == species_id
                and row.get("sourceId") == source_id
            ):
                return {
                    key: copy.deepcopy(row.get(key))
                    for key in (
                        "bibliographicMetadataMatches",
                        "originalBylineChecked",
                        "claimLocatorVerified",
                        "fullTextAccessConfirmed",
                        "doiMetadataValid",
                        "abstractOnly",
                        "verificationStatus",
                    )
                }
    return {}


class ResearchPipeline:
    def __init__(
        self,
        archive_dir: Path,
        override_file: Path,
        expected_species_file: Path | None = DEFAULT_EXPECTED_SPECIES_FILE,
    ) -> None:
        self.archive_dir = archive_dir
        self.override_file = override_file
        self.expected_species_file = expected_species_file
        self.diagnostics: list[dict[str, Any]] = []
        self.archive_checks: list[dict[str, Any]] = []
        self.archive_manifest: list[dict[str, Any]] = []
        self.species_records: dict[str, dict[str, Any]] = {}
        self.sources: dict[str, dict[str, Any]] = {}
        self.evidence: list[dict[str, Any]] = []
        self.rules: list[dict[str, Any]] = []
        self.source_type_observations: dict[str, set[str]] = defaultdict(set)
        self.overrides = self._load_overrides()
        self.expected_species_ids = self._load_expected_species()

    def diagnostic(
        self,
        severity: str,
        code: str,
        message: str,
        **context: Any,
    ) -> None:
        item = {"severity": severity, "code": code, "message": message}
        item.update({key: value for key, value in context.items() if value is not None})
        self.diagnostics.append(item)

    def _load_overrides(self) -> dict[tuple[str, str, str], dict[str, Any]]:
        if not self.override_file.exists():
            return {}
        value = json.loads(self.override_file.read_text(encoding="utf-8"))
        result: dict[tuple[str, str, str], dict[str, Any]] = {}
        for item in value.get("overrides", []):
            key = (
                str(item.get("archiveId")),
                str(item.get("speciesId")),
                str(item.get("localSourceId")),
            )
            result[key] = item
        return result

    def _load_expected_species(self) -> set[str]:
        if self.expected_species_file is None or not self.expected_species_file.exists():
            return set()
        value = json.loads(self.expected_species_file.read_text(encoding="utf-8"))
        return {slug(item) for item in value.get("speciesIds", []) if item}

    def run(self) -> dict[str, Any]:
        archives = sorted(
            self.archive_dir.glob("*.zip"),
            key=lambda path: (
                int(match.group(1))
                if (match := re.search(r"batch-(\d+)", path.name))
                else 999,
                path.name,
            ),
        )
        if not archives:
            self.diagnostic(
                "error",
                "archives.none",
                "No research ZIP archives were found.",
                archiveDirectory=str(self.archive_dir),
            )
        for archive in archives:
            self._import_archive(archive)
        if self.expected_species_ids:
            imported_species_ids = set(self.species_records)
            missing = sorted(self.expected_species_ids - imported_species_ids)
            unexpected = sorted(imported_species_ids - self.expected_species_ids)
            if missing:
                self.diagnostic(
                    "error",
                    "catalog.expected-species-missing",
                    "The canonical research library is missing expected BiteMap species.",
                    speciesIds=missing,
                )
            if unexpected:
                self.diagnostic(
                    "error",
                    "catalog.unexpected-species",
                    "The research library contains species outside the configured catalog.",
                    speciesIds=unexpected,
                )
        self._finalize_sources()
        self._validate_canonical_links()
        return self._outputs()

    def _read_json(self, archive: ZipFile, path: str) -> dict[str, Any]:
        value = json.loads(archive.read(path).decode("utf-8-sig"))
        if not isinstance(value, dict):
            raise ValueError(f"Expected a JSON object at {path}")
        return value

    def _import_archive(self, archive_path: Path) -> None:
        archive_hash = sha256_file(archive_path)
        try:
            archive = ZipFile(archive_path)
        except BadZipFile:
            self.diagnostic(
                "error",
                "archive.invalid-zip",
                "Archive is not a valid ZIP file.",
                archiveFilename=archive_path.name,
            )
            return

        with archive:
            names = set(archive.namelist())
            manifest_candidates = [
                name for name in names if posixpath.basename(name) == "manifest.json"
            ]
            if not manifest_candidates:
                self.diagnostic(
                    "error",
                    "archive.missing-manifest",
                    "Archive has no manifest.json.",
                    archiveFilename=archive_path.name,
                )
                return
            manifest_path = sorted(manifest_candidates, key=lambda value: (value.count("/"), value))[0]
            root = posixpath.dirname(manifest_path)
            validation_path = f"{root}/validation-report.json" if root else "validation-report.json"
            try:
                manifest = self._read_json(archive, manifest_path)
                validation = (
                    self._read_json(archive, validation_path)
                    if validation_path in names
                    else {}
                )
            except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
                self.diagnostic(
                    "error",
                    "archive.invalid-control-json",
                    str(exc),
                    archiveFilename=archive_path.name,
                )
                return

            batch_match = re.search(r"batch-(\d+)", archive_path.name)
            archive_id = clean_string(manifest.get("batchId")) or (
                f"batch-{batch_match.group(1)}" if batch_match else archive_path.stem
            )
            archive_id = slug(archive_id)
            if validation_path not in names:
                self.diagnostic(
                    "warning",
                    "archive.missing-validation-report",
                    "Archive has no separate validation report; claims remain unverified.",
                    archiveId=archive_id,
                )
            search_audit_path = (
                f"{root}/search-breadth-audit.json"
                if root
                else "search-breadth-audit.json"
            )
            if search_audit_path not in names:
                self.diagnostic(
                    "warning",
                    "archive.missing-search-breadth-audit",
                    "Archive has no separate search-breadth audit.",
                    archiveId=archive_id,
                )

            species_json_paths: list[str] = []
            prefix = f"{root}/" if root else ""
            for name in names:
                if not name.startswith(prefix) or not name.endswith(".json"):
                    continue
                relative = name[len(prefix) :]
                parts = relative.split("/")
                if len(parts) == 2 and parts[0] == posixpath.splitext(parts[1])[0]:
                    species_json_paths.append(name)
            species_json_paths.sort()

            imported_counts = Counter()
            archive_species: list[str] = []
            archive_zero_weight_variables = 0
            archive_source_verifications = 0
            archive_evidence_locators = 0
            archive_claim_locators_verified = 0

            for record_path in species_json_paths:
                try:
                    raw_bytes = archive.read(record_path)
                    record = json.loads(raw_bytes.decode("utf-8-sig"))
                except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                    self.diagnostic(
                        "error",
                        "species.invalid-json",
                        str(exc),
                        archiveId=archive_id,
                        recordPath=record_path,
                    )
                    continue
                if not isinstance(record, dict):
                    self.diagnostic(
                        "error",
                        "species.not-object",
                        "Species JSON is not an object.",
                        archiveId=archive_id,
                        recordPath=record_path,
                    )
                    continue

                species_id = slug(record.get("speciesId") or posixpath.basename(posixpath.dirname(record_path)))
                archive_species.append(species_id)
                md_path = posixpath.splitext(record_path)[0] + ".md"
                pdf_path = posixpath.splitext(record_path)[0] + ".pdf"
                for expected_path, kind in ((md_path, "Markdown"), (pdf_path, "PDF")):
                    if expected_path not in names:
                        self.diagnostic(
                            "error",
                            "species.missing-companion",
                            f"Species is missing its {kind} report.",
                            archiveId=archive_id,
                            speciesId=species_id,
                            expectedPath=expected_path,
                        )

                sources = record.get("sources") if isinstance(record.get("sources"), list) else []
                evidence = (
                    record.get("evidenceLedger")
                    if isinstance(record.get("evidenceLedger"), list)
                    else []
                )
                rules = (
                    record.get("candidateModelRules")
                    if isinstance(record.get("candidateModelRules"), list)
                    else []
                )
                zero_weight_variables = record.get("zeroWeightVariables")
                if isinstance(zero_weight_variables, (list, dict)):
                    archive_zero_weight_variables += len(zero_weight_variables)

                local_source_map: dict[str, str] = {}
                local_source_verification: dict[str, dict[str, Any]] = {}
                for source in sources:
                    if not isinstance(source, dict):
                        self.diagnostic(
                            "error",
                            "source.not-object",
                            "Source record is not an object.",
                            archiveId=archive_id,
                            speciesId=species_id,
                        )
                        continue
                    local_id = clean_string(source.get("sourceId")) or "unknown"
                    if local_id in local_source_map:
                        self.diagnostic(
                            "error",
                            "source.duplicate-local-id",
                            "Duplicate source ID within a species record.",
                            archiveId=archive_id,
                            speciesId=species_id,
                            localSourceId=local_id,
                        )
                        continue
                    original_source = copy.deepcopy(source)
                    override = self.overrides.get((archive_id, species_id, local_id))
                    corrections: list[dict[str, Any]] = []
                    if override:
                        for field, new_value in override.get("set", {}).items():
                            old_value = source.get(field)
                            source[field] = new_value
                            corrections.append(
                                {"field": field, "from": old_value, "to": new_value}
                            )

                    source["year"] = normalize_year(source.get("year"))
                    source["doi"] = normalize_doi(source.get("doi"))
                    source["url"] = normalize_url(source.get("url"))
                    verification = verification_for_source(
                        source, validation, species_id, local_id
                    )
                    access_mode_text = str(source.get("accessMode") or "").lower()
                    if (
                        "abstract" in access_mode_text
                        and verification.get("fullTextAccessConfirmed") is not True
                    ):
                        verification.setdefault("abstractOnly", True)
                    if (
                        "full-text" in access_mode_text
                        and "abstract" not in access_mode_text
                    ):
                        verification.setdefault("fullTextAccessConfirmed", True)
                    local_source_verification[local_id] = verification
                    if verification:
                        archive_source_verifications += int(
                            verification.get("claimLocatorVerified") is True
                        )

                    studied = source.get("speciesActuallyStudied")
                    self.source_type_observations["speciesActuallyStudied"].add(
                        type(studied).__name__
                    )
                    self.source_type_observations["year"].add(
                        type(original_source.get("year")).__name__
                    )
                    if studied is True:
                        studied_values = [
                            clean_string(record.get("acceptedScientificName"))
                            or clean_string(record.get("suppliedScientificName"))
                            or species_id
                        ]
                    elif isinstance(studied, str):
                        studied_values = [studied]
                    elif isinstance(studied, list):
                        studied_values = [str(value) for value in studied if value]
                    else:
                        studied_values = []

                    source_id = canonical_source_id(source)
                    local_source_map[local_id] = source_id
                    occurrence = {
                        "archiveId": archive_id,
                        "archiveFilename": archive_path.name,
                        "speciesId": species_id,
                        "localSourceId": local_id,
                        "accessMode": clean_string(source.get("accessMode")),
                        "verificationStatus": clean_string(
                            source.get("verificationStatus")
                        )
                        or "AI-reviewed-unverified",
                        "verification": verification,
                    }
                    if corrections:
                        occurrence["correction"] = {
                            "reason": override.get("reason"),
                            "verifiedAgainst": override.get("verifiedAgainst", []),
                            "changes": corrections,
                            "originalMetadata": original_source,
                        }

                    url_flag = generic_url_reason(source.get("url"))
                    source_flags = [url_flag] if url_flag else []
                    if url_flag:
                        self.diagnostic(
                            "warning",
                            f"source.{url_flag}",
                            "Source URL does not identify a stable source record.",
                            archiveId=archive_id,
                            speciesId=species_id,
                            localSourceId=local_id,
                            url=source.get("url"),
                        )

                    if source_id not in self.sources:
                        self.sources[source_id] = {
                            "sourceId": source_id,
                            "identityKey": canonical_source_key(source),
                            "type": clean_string(source.get("type")),
                            "title": clean_string(source.get("title")) or "Untitled source",
                            "authorsOrAgency": clean_string(source.get("authorsOrAgency"))
                            or "Unknown",
                            "year": source.get("year"),
                            "journalOrPublisher": clean_string(
                                source.get("journalOrPublisher")
                            ),
                            "doi": source.get("doi"),
                            "url": source.get("url"),
                            "geographicScopes": [],
                            "speciesActuallyStudied": [],
                            "accessModes": [],
                            "verificationStatuses": [],
                            "flags": [],
                            "metadataVariants": [],
                            "occurrences": [],
                        }
                    canonical_source = self.sources[source_id]
                    canonical_source["occurrences"].append(occurrence)
                    canonical_source["flags"].extend(source_flags)
                    for scope in [clean_string(source.get("geographicScope"))]:
                        if scope:
                            canonical_source["geographicScopes"].append(scope)
                    canonical_source["speciesActuallyStudied"].extend(studied_values)
                    for mode in [clean_string(source.get("accessMode"))]:
                        if mode:
                            canonical_source["accessModes"].append(mode)
                    canonical_source["verificationStatuses"].append(
                        occurrence["verificationStatus"]
                    )

                    variant = {
                        "title": clean_string(source.get("title")),
                        "authorsOrAgency": clean_string(source.get("authorsOrAgency")),
                        "year": source.get("year"),
                        "journalOrPublisher": clean_string(
                            source.get("journalOrPublisher")
                        ),
                        "doi": source.get("doi"),
                        "url": source.get("url"),
                    }
                    baseline = {
                        key: canonical_source.get(key)
                        for key in (
                            "title",
                            "authorsOrAgency",
                            "year",
                            "journalOrPublisher",
                            "doi",
                            "url",
                        )
                    }
                    if variant != baseline and variant not in canonical_source["metadataVariants"]:
                        canonical_source["metadataVariants"].append(variant)

                local_evidence_map: dict[str, str] = {}
                evidence_by_id: dict[str, dict[str, Any]] = {}
                for evidence_item in evidence:
                    if not isinstance(evidence_item, dict):
                        self.diagnostic(
                            "error",
                            "evidence.not-object",
                            "Evidence record is not an object.",
                            archiveId=archive_id,
                            speciesId=species_id,
                        )
                        continue
                    local_id = clean_string(evidence_item.get("evidenceId")) or "unknown"
                    if local_id in local_evidence_map:
                        self.diagnostic(
                            "error",
                            "evidence.duplicate-local-id",
                            "Duplicate evidence ID within a species record.",
                            archiveId=archive_id,
                            speciesId=species_id,
                            localEvidenceId=local_id,
                        )
                        continue
                    evidence_id = f"ev-{archive_id}-{species_id}-{slug(local_id)}"
                    local_evidence_map[local_id] = evidence_id
                    local_source_id = clean_string(evidence_item.get("sourceId")) or "unknown"
                    source_id = local_source_map.get(local_source_id)
                    if not source_id:
                        self.diagnostic(
                            "error",
                            "evidence.broken-source-id",
                            "Evidence references an unknown local source ID.",
                            archiveId=archive_id,
                            speciesId=species_id,
                            localEvidenceId=local_id,
                            localSourceId=local_source_id,
                        )
                    locator = evidence_item.get("sourceLocator")
                    if not isinstance(locator, dict):
                        locator = {}
                    normalized_locator = {
                        key: locator.get(key) for key in ("page", "section", "table", "figure")
                    }
                    has_locator = any(value not in (None, "") for value in normalized_locator.values())
                    archive_evidence_locators += int(has_locator)
                    verification = local_source_verification.get(local_source_id, {})
                    claim_verified = evidence_item.get("claimLocatorVerified")
                    if claim_verified is None:
                        claim_verified = verification.get("claimLocatorVerified")
                    archive_claim_locators_verified += int(claim_verified is True)
                    normalized_evidence = {
                        "evidenceId": evidence_id,
                        "archiveId": archive_id,
                        "speciesId": species_id,
                        "localEvidenceId": local_id,
                        "sourceId": source_id,
                        "localSourceId": local_source_id,
                        "variable": clean_string(evidence_item.get("variable")) or "unknown",
                        "exactConditionOrRange": evidence_item.get("exactConditionOrRange"),
                        "observedEffect": evidence_item.get("observedEffect"),
                        "whatWasMeasured": evidence_item.get("whatWasMeasured"),
                        "endpointCategory": endpoint_category(evidence_item),
                        "populationLocation": evidence_item.get("populationLocation"),
                        "lifeStage": evidence_item.get("lifeStage"),
                        "evidenceType": evidence_item.get("evidenceType"),
                        "novaApplicability": evidence_item.get("novaApplicability"),
                        "confidence": evidence_item.get("confidence"),
                        "sourceLocator": normalized_locator,
                        "claimLocatorVerified": claim_verified,
                        "limitations": evidence_item.get("limitations"),
                        "recommendedModelUse": normalize_model_use(
                            evidence_item.get("recommendedModelUse")
                        ),
                        "surrogateEvidence": bool(evidence_item.get("surrogateEvidence")),
                        "rawRecordSha256": sha256_bytes(json_bytes(evidence_item)),
                    }
                    self.evidence.append(normalized_evidence)
                    evidence_by_id[evidence_id] = normalized_evidence

                candidate_rule_ids: list[str] = []
                for index, rule in enumerate(rules, start=1):
                    if not isinstance(rule, dict):
                        self.diagnostic(
                            "error",
                            "rule.not-object",
                            "Candidate model rule is not an object.",
                            archiveId=archive_id,
                            speciesId=species_id,
                        )
                        continue
                    rule_id = f"rule-{archive_id}-{species_id}-{index:02d}"
                    candidate_rule_ids.append(rule_id)
                    evidence_ids: list[str] = []
                    for local_evidence_id in rule.get("evidenceIds") or []:
                        evidence_id = local_evidence_map.get(str(local_evidence_id))
                        if not evidence_id:
                            self.diagnostic(
                                "error",
                                "rule.broken-evidence-id",
                                "Candidate rule references an unknown evidence ID.",
                                archiveId=archive_id,
                                speciesId=species_id,
                                ruleId=rule_id,
                                localEvidenceId=local_evidence_id,
                            )
                            continue
                        evidence_ids.append(evidence_id)
                    supporting_evidence = [
                        evidence_by_id[evidence_id]
                        for evidence_id in evidence_ids
                        if evidence_id in evidence_by_id
                    ]
                    source_ids = sorted(
                        {
                            item["sourceId"]
                            for item in supporting_evidence
                            if item.get("sourceId")
                        }
                    )
                    model_use = normalize_model_use(rule.get("recommendedModelUse"))
                    input_details = runtime_input(rule.get("input"))
                    concerns: list[str] = []
                    endpoint_categories = sorted(
                        {item["endpointCategory"] for item in supporting_evidence}
                    )
                    if model_use == "score" and not any(
                        value in {
                            "hook-and-line-catchability",
                            "feeding-or-foraging",
                        }
                        for value in endpoint_categories
                    ):
                        concerns.append("no-direct-feeding-or-catchability-endpoint")
                    if input_details["availability"] in {"unavailable", "unknown"}:
                        concerns.append("runtime-input-not-available")
                    if any(
                        "low" in str(item.get("novaApplicability") or "").lower()
                        for item in supporting_evidence
                    ):
                        concerns.append("low-nova-transferability")
                    if any(
                        not self.sources.get(source_id, {}).get("occurrences")
                        for source_id in source_ids
                    ):
                        concerns.append("source-verification-unavailable")
                    if model_use == "score":
                        provisional_disposition = (
                            "experimental-runtime-input-gap"
                            if input_details["availability"] in {"unavailable", "unknown"}
                            else "production-candidate-review-required"
                        )
                        scientific_review_status = "pending-scientific-review"
                    else:
                        provisional_disposition = model_use
                        scientific_review_status = "classification-imported"
                    normalized_rule = {
                        "ruleId": rule_id,
                        "archiveId": archive_id,
                        "speciesId": species_id,
                        "input": clean_string(rule.get("input")) or "unknown",
                        **input_details,
                        "condition": rule.get("condition"),
                        "direction": rule.get("direction"),
                        "strength": rule.get("strength"),
                        "confidence": rule.get("confidence"),
                        "mechanism": rule.get("mechanism"),
                        "recommendedModelUse": model_use,
                        "evidenceIds": evidence_ids,
                        "sourceIds": source_ids,
                        "endpointCategories": endpoint_categories,
                        "doubleCountingRisk": rule.get("doubleCountingRisk"),
                        "scientificReviewStatus": scientific_review_status,
                        "provisionalDisposition": provisional_disposition,
                        "concerns": sorted(set(concerns)),
                    }
                    self.rules.append(normalized_rule)

                taxonomy_source_ids = []
                for local_id in record.get("taxonomySourceIds") or []:
                    source_id = local_source_map.get(str(local_id))
                    if source_id:
                        taxonomy_source_ids.append(source_id)

                topic_findings = {
                    key: copy.deepcopy(record.get(key))
                    for key in TOPIC_KEYS
                    if key in record
                }
                normalized_species = {
                    "speciesId": species_id,
                    "commonName": clean_string(record.get("commonName")) or species_id,
                    "suppliedScientificName": clean_string(
                        record.get("suppliedScientificName")
                    ),
                    "acceptedScientificName": clean_string(
                        record.get("acceptedScientificName")
                    )
                    or clean_string(record.get("suppliedScientificName"))
                    or species_id,
                    "taxonomicAliases": [
                        str(value)
                        for value in (record.get("taxonomicAliases") or [])
                        if value
                    ],
                    "taxonomyNotes": copy.deepcopy(record.get("taxonomyNotes")),
                    "researchStatus": normalize_research_status(
                        record.get("researchStatus")
                    ),
                    "currentBiteMapStatus": normalize_current_status(
                        record.get("currentBiteMapStatus")
                    ),
                    "promotionRecommendation": recommendation_from_record(record),
                    "executiveConclusion": copy.deepcopy(
                        record.get("executiveConclusion")
                    ),
                    "targetabilityAssessment": copy.deepcopy(
                        record.get("targetabilityAssessment")
                    ),
                    "finalVerdict": copy.deepcopy(record.get("finalVerdict")),
                    "topicFindings": topic_findings,
                    "zeroWeightVariables": copy.deepcopy(
                        record.get("zeroWeightVariables")
                    ),
                    "missingResearch": copy.deepcopy(record.get("missingResearch")),
                    "sourceIds": sorted(set(local_source_map.values())),
                    "evidenceIds": sorted(local_evidence_map.values()),
                    "candidateRuleIds": candidate_rule_ids,
                    "taxonomySourceIds": sorted(set(taxonomy_source_ids)),
                    "rawRecordSha256": sha256_bytes(raw_bytes),
                    "provenance": {
                        "archiveId": archive_id,
                        "archiveFilename": archive_path.name,
                        "recordPath": record_path,
                    },
                }
                if species_id in self.species_records:
                    self.diagnostic(
                        "error",
                        "species.duplicate-across-archives",
                        "Species appears in more than one imported archive.",
                        speciesId=species_id,
                        archiveId=archive_id,
                        priorArchiveId=self.species_records[species_id]["provenance"][
                            "archiveId"
                        ],
                    )
                else:
                    self.species_records[species_id] = normalized_species

                imported_counts["species"] += 1
                imported_counts["sources"] += len(sources)
                imported_counts["evidenceRecords"] += len(evidence)
                for rule in rules:
                    if isinstance(rule, dict):
                        use = normalize_model_use(rule.get("recommendedModelUse"))
                        imported_counts[
                            {
                                "score": "scoreRules",
                                "context-only": "contextOnlyRules",
                                "zero-weight": "zeroWeightRules",
                                "unavailable": "unavailableRules",
                            }[use]
                        ] += 1
                for source in sources:
                    if not isinstance(source, dict):
                        continue
                    verification = verification_for_source(
                        source,
                        validation,
                        species_id,
                        str(source.get("sourceId")),
                    )
                    access_mode = str(source.get("accessMode") or "").lower()
                    if (
                        "abstract" in access_mode
                        and verification.get("fullTextAccessConfirmed") is not True
                    ):
                        verification.setdefault("abstractOnly", True)
                    if verification.get("fullTextAccessConfirmed") is True or access_mode == "full-text":
                        imported_counts["fullTextSources"] += 1
                    if verification.get("abstractOnly") is True:
                        imported_counts["abstractOnlySources"] += 1

            manifest_counts = manifest.get("counts") if isinstance(manifest.get("counts"), dict) else {}
            count_diagnostics: list[dict[str, Any]] = []
            for key in (
                "species",
                "sources",
                "evidenceRecords",
                "scoreRules",
                "contextOnlyRules",
                "fullTextSources",
                "abstractOnlySources",
            ):
                if key in manifest_counts and manifest_counts.get(key) != imported_counts.get(key, 0):
                    count_diagnostics.append(
                        {
                            "field": key,
                            "manifest": manifest_counts.get(key),
                            "imported": imported_counts.get(key, 0),
                        }
                    )
                    self.diagnostic(
                        "warning",
                        "manifest.count-mismatch",
                        "Manifest count does not match imported records.",
                        archiveId=archive_id,
                        field=key,
                        manifestValue=manifest_counts.get(key),
                        importedValue=imported_counts.get(key, 0),
                    )

            manifest_zero = manifest_counts.get("zeroWeightRules")
            imported_zero = imported_counts.get("zeroWeightRules", 0)
            combined_zero = imported_zero + archive_zero_weight_variables
            if manifest_zero is not None and manifest_zero != imported_zero:
                code = (
                    "manifest.zero-weight-mixed-semantics"
                    if manifest_zero == combined_zero
                    else "manifest.zero-weight-count-mismatch"
                )
                self.diagnostic(
                    "warning",
                    code,
                    "Manifest zero-weight count uses different semantics from candidate rules.",
                    archiveId=archive_id,
                    manifestValue=manifest_zero,
                    candidateRuleCount=imported_zero,
                    zeroWeightVariableCount=archive_zero_weight_variables,
                )

            locator_value = manifest_counts.get("verifiedSourceLocators")
            locator_matches: list[str] = []
            for label, value in (
                ("evidence-with-nonempty-locator", archive_evidence_locators),
                ("source-verification-rows", archive_source_verifications),
                ("evidence-claims-marked-verified", archive_claim_locators_verified),
            ):
                if locator_value == value:
                    locator_matches.append(label)

            self.archive_checks.append(
                {
                    "archiveId": archive_id,
                    "selfReportedStatus": validation.get("overallStatus")
                    or validation.get("allSpeciesPass"),
                    "manifestCountMismatches": count_diagnostics,
                    "verifiedSourceLocatorsManifestValue": locator_value,
                    "verifiedSourceLocatorsPossibleSemantics": locator_matches,
                    "unresolvedIssueCount": manifest_counts.get("unresolvedIssues")
                    or validation.get("unresolvedIssueCount")
                    or len(validation.get("unresolvedIssues") or []),
                }
            )
            self.archive_manifest.append(
                {
                    "archiveId": archive_id,
                    "filename": archive_path.name,
                    "sizeBytes": archive_path.stat().st_size,
                    "sha256": archive_hash,
                    "manifestSchemaVersion": manifest.get("schemaVersion"),
                    "speciesIds": sorted(archive_species),
                    "manifestCounts": manifest_counts,
                    "importedCounts": dict(sorted(imported_counts.items())),
                }
            )

    def _finalize_sources(self) -> None:
        for source in self.sources.values():
            for key in (
                "geographicScopes",
                "speciesActuallyStudied",
                "accessModes",
                "verificationStatuses",
                "flags",
            ):
                source[key] = sorted(set(value for value in source[key] if value))
            source["occurrences"] = sorted(
                source["occurrences"],
                key=lambda row: (
                    row["archiveId"],
                    row["speciesId"],
                    row["localSourceId"],
                ),
            )
            verification_rows = [
                occurrence.get("verification") or {}
                for occurrence in source["occurrences"]
            ]
            source["verificationSummary"] = {
                "verificationStatuses": source["verificationStatuses"],
                "humanVerified": any(
                    str(status).lower().startswith("human")
                    for status in source["verificationStatuses"]
                ),
                "bibliographicMetadataMatchedOccurrences": sum(
                    row.get("bibliographicMetadataMatches") is True
                    for row in verification_rows
                ),
                "originalBylineCheckedOccurrences": sum(
                    row.get("originalBylineChecked") is True
                    for row in verification_rows
                ),
                "claimLocatorVerifiedOccurrences": sum(
                    row.get("claimLocatorVerified") is True for row in verification_rows
                ),
                "fullTextConfirmedOccurrences": sum(
                    row.get("fullTextAccessConfirmed") is True
                    for row in verification_rows
                ),
                "abstractOnlyOccurrences": sum(
                    row.get("abstractOnly") is True for row in verification_rows
                ),
            }
            year = source.get("year")
            source["citation"] = (
                f"{source['authorsOrAgency']} ({year if year is not None else 'n.d.'}). "
                f"{source['title']}."
                + (
                    f" {source['journalOrPublisher']}."
                    if source.get("journalOrPublisher")
                    else ""
                )
            )

        title_groups: dict[tuple[str, int | None, str], list[str]] = defaultdict(list)
        for source_id, source in self.sources.items():
            title_groups[
                (
                    slug(source.get("title")),
                    source.get("year"),
                    slug(source.get("authorsOrAgency")),
                )
            ].append(source_id)
        for (title, year, author), source_ids in title_groups.items():
            if len(source_ids) > 1:
                self.diagnostic(
                    "warning",
                    "source.possible-duplicate-citation",
                    "Matching author/title/year records produced different canonical source IDs.",
                    normalizedTitle=title,
                    normalizedAuthor=author,
                    year=year,
                    sourceIds=sorted(source_ids),
                )

    def _validate_canonical_links(self) -> None:
        source_ids = set(self.sources)
        evidence_ids = {item["evidenceId"] for item in self.evidence}
        rule_ids = {item["ruleId"] for item in self.rules}
        if len(evidence_ids) != len(self.evidence):
            self.diagnostic(
                "error",
                "canonical.duplicate-evidence-id",
                "Canonical evidence IDs are not unique.",
            )
        if len(rule_ids) != len(self.rules):
            self.diagnostic(
                "error",
                "canonical.duplicate-rule-id",
                "Canonical candidate rule IDs are not unique.",
            )
        for item in self.evidence:
            if item.get("sourceId") not in source_ids:
                self.diagnostic(
                    "error",
                    "canonical.evidence-source-missing",
                    "Canonical evidence references a missing source.",
                    evidenceId=item["evidenceId"],
                    sourceId=item.get("sourceId"),
                )
        for rule in self.rules:
            missing = [value for value in rule["evidenceIds"] if value not in evidence_ids]
            if missing:
                self.diagnostic(
                    "error",
                    "canonical.rule-evidence-missing",
                    "Canonical rule references missing evidence.",
                    ruleId=rule["ruleId"],
                    evidenceIds=missing,
                )
        for species in self.species_records.values():
            for key, valid_ids in (
                ("sourceIds", source_ids),
                ("evidenceIds", evidence_ids),
                ("candidateRuleIds", rule_ids),
            ):
                missing = [value for value in species[key] if value not in valid_ids]
                if missing:
                    self.diagnostic(
                        "error",
                        "canonical.species-reference-missing",
                        "Canonical species record contains unresolved references.",
                        speciesId=species["speciesId"],
                        field=key,
                        missingIds=missing,
                    )

    def _coverage_matrix(self) -> dict[str, Any]:
        evidence_by_species: dict[str, list[dict[str, Any]]] = defaultdict(list)
        rules_by_species: dict[str, list[dict[str, Any]]] = defaultdict(list)
        sources_by_species: dict[str, set[str]] = defaultdict(set)
        for item in self.evidence:
            evidence_by_species[item["speciesId"]].append(item)
        for item in self.rules:
            rules_by_species[item["speciesId"]].append(item)
        for source_id, source in self.sources.items():
            for occurrence in source["occurrences"]:
                sources_by_species[occurrence["speciesId"]].add(source_id)

        species_rows = []
        for species_id, species in sorted(self.species_records.items()):
            evidence = evidence_by_species[species_id]
            rules = rules_by_species[species_id]
            endpoint_counts = Counter(item["endpointCategory"] for item in evidence)
            rule_counts = Counter(item["recommendedModelUse"] for item in rules)
            score_rules = [item for item in rules if item["recommendedModelUse"] == "score"]
            availability_counts = Counter(
                item["availability"] for item in score_rules
            )
            source_records = [
                self.sources[source_id]
                for source_id in sources_by_species[species_id]
            ]
            species_rows.append(
                {
                    "speciesId": species_id,
                    "commonName": species["commonName"],
                    "acceptedScientificName": species["acceptedScientificName"],
                    "archiveId": species["provenance"]["archiveId"],
                    "researchStatus": species["researchStatus"],
                    "currentBiteMapStatus": species["currentBiteMapStatus"],
                    "promotionRecommendation": species["promotionRecommendation"],
                    "uniqueSources": len(source_records),
                    "fullTextSourceOccurrences": sum(
                        source["verificationSummary"]["fullTextConfirmedOccurrences"]
                        for source in source_records
                    ),
                    "abstractOnlySourceOccurrences": sum(
                        source["verificationSummary"]["abstractOnlyOccurrences"]
                        for source in source_records
                    ),
                    "evidenceRecords": len(evidence),
                    "endpointCounts": dict(sorted(endpoint_counts.items())),
                    "candidateRuleCounts": dict(sorted(rule_counts.items())),
                    "scoreRuleRuntimeAvailability": dict(
                        sorted(availability_counts.items())
                    ),
                    "scoreRulesPendingScientificReview": len(score_rules),
                }
            )
        return {
            "schemaVersion": SCHEMA_VERSION,
            "pipelineVersion": PIPELINE_VERSION,
            "totals": {
                "archives": len(self.archive_manifest),
                "species": len(self.species_records),
                "uniqueSources": len(self.sources),
                "sourceOccurrences": sum(
                    len(source["occurrences"]) for source in self.sources.values()
                ),
                "evidenceRecords": len(self.evidence),
                "candidateRules": len(self.rules),
                "scoreRulesPendingScientificReview": sum(
                    rule["recommendedModelUse"] == "score" for rule in self.rules
                ),
            },
            "species": species_rows,
        }

    def _runtime_matrix(self) -> dict[str, Any]:
        grouped: dict[str, dict[str, Any]] = {}
        for rule in self.rules:
            key = rule["inputKey"]
            row = grouped.setdefault(
                key,
                {
                    "inputKey": key,
                    "availability": rule["availability"],
                    "forecastResolutions": [],
                    "originalInputs": [],
                    "ruleIds": [],
                    "scoreRuleIds": [],
                    "speciesIds": [],
                },
            )
            availability_order = {
                "available": 0,
                "modeled": 1,
                "conditional": 2,
                "unknown": 3,
                "unavailable": 4,
            }
            if availability_order[rule["availability"]] > availability_order[row["availability"]]:
                row["availability"] = rule["availability"]
            row["forecastResolutions"].append(rule["forecastResolution"])
            row["originalInputs"].append(rule["input"])
            row["ruleIds"].append(rule["ruleId"])
            if rule["recommendedModelUse"] == "score":
                row["scoreRuleIds"].append(rule["ruleId"])
            row["speciesIds"].append(rule["speciesId"])
        for row in grouped.values():
            for key in (
                "forecastResolutions",
                "originalInputs",
                "ruleIds",
                "scoreRuleIds",
                "speciesIds",
            ):
                row[key] = sorted(set(row[key]))
        return {
            "schemaVersion": SCHEMA_VERSION,
            "pipelineVersion": PIPELINE_VERSION,
            "note": "Availability describes the current BiteMap data layer, not scientific approval. Every score rule remains pending model-translation review.",
            "inputs": [grouped[key] for key in sorted(grouped)],
        }

    def _outputs(self) -> dict[str, Any]:
        self.archive_manifest.sort(key=lambda row: row["archiveId"])
        aggregate_hash = sha256_bytes(
            "".join(row["sha256"] for row in self.archive_manifest).encode("ascii")
        )
        source_values = [self.sources[key] for key in sorted(self.sources)]
        evidence_values = sorted(
            self.evidence, key=lambda row: (row["speciesId"], row["evidenceId"])
        )
        rule_values = sorted(
            self.rules, key=lambda row: (row["speciesId"], row["ruleId"])
        )
        diagnostics = sorted(
            self.diagnostics,
            key=lambda row: (
                0 if row["severity"] == "error" else 1,
                row["code"],
                str(row.get("archiveId") or ""),
                str(row.get("speciesId") or ""),
                str(row.get("localSourceId") or ""),
            ),
        )
        error_count = sum(row["severity"] == "error" for row in diagnostics)
        warning_count = sum(row["severity"] == "warning" for row in diagnostics)
        schema_drift = {
            key: sorted(values)
            for key, values in sorted(self.source_type_observations.items())
        }
        if len(schema_drift.get("speciesActuallyStudied", [])) > 1:
            diagnostics.append(
                {
                    "severity": "warning",
                    "code": "schema-drift.species-actually-studied-types",
                    "message": "Source records use multiple types for speciesActuallyStudied; canonical output normalizes them to strings.",
                    "observedTypes": schema_drift["speciesActuallyStudied"],
                }
            )
            warning_count += 1
        if len(schema_drift.get("year", [])) > 1:
            diagnostics.append(
                {
                    "severity": "warning",
                    "code": "schema-drift.year-types",
                    "message": "Source records use multiple year types; canonical output normalizes valid four-digit years to integers and retains unknown years as null.",
                    "observedTypes": schema_drift["year"],
                }
            )
            warning_count += 1

        archive_ids = [row["archiveId"] for row in self.archive_manifest]
        return {
            "archive-manifest.json": {
                "schemaVersion": SCHEMA_VERSION,
                "pipelineVersion": PIPELINE_VERSION,
                "aggregateSha256": aggregate_hash,
                "totalBytes": sum(row["sizeBytes"] for row in self.archive_manifest),
                "archives": self.archive_manifest,
            },
            "species-research.json": {
                "schemaVersion": SCHEMA_VERSION,
                "pipelineVersion": PIPELINE_VERSION,
                "archiveIds": archive_ids,
                "species": [
                    self.species_records[key] for key in sorted(self.species_records)
                ],
            },
            "source-registry.json": {
                "schemaVersion": SCHEMA_VERSION,
                "pipelineVersion": PIPELINE_VERSION,
                "sourceCount": len(source_values),
                "sourceOccurrenceCount": sum(
                    len(source["occurrences"]) for source in source_values
                ),
                "sources": source_values,
            },
            "evidence-library.json": {
                "schemaVersion": SCHEMA_VERSION,
                "pipelineVersion": PIPELINE_VERSION,
                "evidenceCount": len(evidence_values),
                "evidence": evidence_values,
            },
            "model-translation-queue.json": {
                "schemaVersion": SCHEMA_VERSION,
                "pipelineVersion": PIPELINE_VERSION,
                "notice": "Candidate score rules are not production approvals. Every score rule requires scientific and runtime review.",
                "ruleCount": len(rule_values),
                "scoreRuleCount": sum(
                    rule["recommendedModelUse"] == "score" for rule in rule_values
                ),
                "rules": rule_values,
            },
            "runtime-input-matrix.json": self._runtime_matrix(),
            "coverage-matrix.json": self._coverage_matrix(),
            "validation-report.json": {
                "schemaVersion": SCHEMA_VERSION,
                "pipelineVersion": PIPELINE_VERSION,
                "status": "fail" if error_count else "pass-with-warnings",
                "errorCount": error_count,
                "warningCount": warning_count,
                "schemaDrift": schema_drift,
                "archiveChecks": sorted(
                    self.archive_checks, key=lambda row: row["archiveId"]
                ),
                "diagnostics": diagnostics,
            },
        }


def write_or_check(outputs: dict[str, Any], output_dir: Path, check: bool) -> list[str]:
    differences: list[str] = []
    if check:
        for filename, value in outputs.items():
            path = output_dir / filename
            expected = json_bytes(value)
            if not path.exists():
                differences.append(f"missing {path}")
            elif path.read_bytes() != expected:
                differences.append(f"stale {path}")
        expected_names = set(outputs)
        if output_dir.exists():
            for path in output_dir.glob("*.json"):
                if path.name not in expected_names:
                    differences.append(f"unexpected {path}")
        return differences

    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="bitemap-species-research-") as temp:
        temp_dir = Path(temp)
        for filename, value in outputs.items():
            (temp_dir / filename).write_bytes(json_bytes(value))
        for filename in outputs:
            (temp_dir / filename).replace(output_dir / filename)
    return differences


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archives", type=Path, default=DEFAULT_ARCHIVE_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDE_FILE)
    parser.add_argument(
        "--expected-species",
        type=Path,
        default=DEFAULT_EXPECTED_SPECIES_FILE,
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if generated artifacts are missing or stale.",
    )
    parser.add_argument(
        "--strict-warnings",
        action="store_true",
        help="Treat validation warnings as a failing exit status.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    pipeline = ResearchPipeline(
        args.archives.resolve(),
        args.overrides.resolve(),
        args.expected_species.resolve(),
    )
    outputs = pipeline.run()
    differences = write_or_check(outputs, args.output.resolve(), args.check)
    validation = outputs["validation-report.json"]
    summary = outputs["coverage-matrix.json"]["totals"]
    print(
        "Species research pipeline: "
        f"{summary['archives']} archives, {summary['species']} species, "
        f"{summary['uniqueSources']} unique sources, "
        f"{summary['evidenceRecords']} evidence records, "
        f"{summary['scoreRulesPendingScientificReview']} score rules pending review."
    )
    print(
        f"Validation: {validation['errorCount']} errors, "
        f"{validation['warningCount']} warnings."
    )
    if differences:
        for difference in differences:
            print(difference, file=sys.stderr)
    if differences or validation["errorCount"]:
        return 1
    if args.strict_warnings and validation["warningCount"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

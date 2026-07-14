"""Sprint 1 intelligence core: waterbodies, aliases, stocking, hydrology stations,
species scoring profiles, ingestion runs, and extended location/species/evidence columns.

Revision ID: 0002_intelligence_core
Revises: 0001_phase1
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_intelligence_core"
down_revision = "0001_phase1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- data ingestion audit log ------------------------------------------
    op.create_table(
        "data_ingestion_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(200), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("records_seen", sa.Integer(), nullable=False),
        sa.Column("records_created", sa.Integer(), nullable=False),
        sa.Column("records_updated", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("checksum", sa.String(64)),
        sa.Column("dataset_version", sa.String(100)),
    )
    op.create_index("ix_data_ingestion_runs_source_name", "data_ingestion_runs", ["source_name"])
    op.create_index("ix_data_ingestion_runs_started_at", "data_ingestion_runs", ["started_at"])

    # --- waterbodies + aliases ---------------------------------------------
    op.create_table(
        "waterbodies",
        sa.Column("id", sa.String(120), primary_key=True),
        sa.Column("official_name", sa.String(200), nullable=False),
        sa.Column("waterbody_type", sa.String(20), nullable=False),
        sa.Column("watershed", sa.String(120)),
        sa.Column("state", sa.String(4), nullable=False),
    )
    op.create_index("ix_waterbodies_official_name", "waterbodies", ["official_name"])
    op.create_index("ix_waterbodies_watershed", "waterbodies", ["watershed"])
    op.create_table(
        "waterbody_aliases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("waterbody_id", sa.String(120), sa.ForeignKey("waterbodies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alias", sa.String(200), nullable=False),
        sa.UniqueConstraint("waterbody_id", "alias", name="uq_waterbody_alias"),
    )
    op.create_index("ix_waterbody_aliases_waterbody_id", "waterbody_aliases", ["waterbody_id"])
    op.create_index("ix_waterbody_aliases_alias", "waterbody_aliases", ["alias"])

    # --- fishing_locations: new columns ------------------------------------
    with op.batch_alter_table("fishing_locations") as batch:
        batch.add_column(sa.Column("waterbody_id", sa.String(120), sa.ForeignKey("waterbodies.id")))
        batch.add_column(sa.Column("waterbody_type", sa.String(20), nullable=False, server_default="lake"))
        batch.add_column(sa.Column("watershed", sa.String(120)))
        batch.add_column(sa.Column("state", sa.String(4), nullable=False, server_default="VA"))
        batch.add_column(sa.Column("access_methods", sa.JSON(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("distance_miles", sa.Float()))
        batch.add_column(sa.Column("travel_minutes", sa.Integer()))
        batch.add_column(sa.Column("activity_estimate", sa.Float(), nullable=False, server_default="0.5"))
        batch.add_column(sa.Column("access_fit", sa.Float(), nullable=False, server_default="0.84"))
        batch.add_column(sa.Column("best_window", sa.String(120)))
        batch.add_column(sa.Column("flow_status", sa.String(200)))
        batch.add_column(sa.Column("notice", sa.Text()))
        batch.add_column(sa.Column("access_authority", sa.String(200)))
        batch.add_column(sa.Column("access_source_url", sa.Text()))
        batch.add_column(sa.Column("source_reviewed", sa.String(80)))
        batch.add_column(sa.Column("details", sa.JSON(), nullable=False, server_default="{}"))
    op.create_index("ix_fishing_locations_watershed", "fishing_locations", ["watershed"])

    op.create_table(
        "fishing_location_aliases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("location_id", sa.String(100), sa.ForeignKey("fishing_locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alias", sa.String(200), nullable=False),
        sa.UniqueConstraint("location_id", "alias", name="uq_location_alias"),
    )
    op.create_index("ix_fishing_location_aliases_location_id", "fishing_location_aliases", ["location_id"])
    op.create_index("ix_fishing_location_aliases_alias", "fishing_location_aliases", ["alias"])

    # --- species: new columns ----------------------------------------------
    with op.batch_alter_table("species") as batch:
        batch.add_column(sa.Column("habitat", sa.Text()))
        batch.add_column(sa.Column("aliases", sa.JSON(), nullable=False, server_default="[]"))

    op.create_table(
        "species_scoring_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("species_id", sa.String(100), sa.ForeignKey("species.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("configuration", sa.JSON(), nullable=False),
        sa.Column("effective_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("species_id", "version", name="uq_species_profile_version"),
    )
    op.create_index("ix_species_scoring_profiles_species_id", "species_scoring_profiles", ["species_id"])

    # --- species_evidence: new columns -------------------------------------
    with op.batch_alter_table("species_evidence") as batch:
        batch.add_column(sa.Column("modeled", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("availability", sa.Float(), nullable=False, server_default="0.0"))
        batch.add_column(sa.Column("quality", sa.Float()))
        batch.add_column(sa.Column("evidence_confidence", sa.Float(), nullable=False, server_default="0.5"))
        batch.add_column(sa.Column("evidence_summary", sa.Text()))
        batch.add_column(sa.Column("last_evidence", sa.String(200)))
        batch.add_column(sa.Column("technique", sa.Text()))
        batch.add_column(sa.Column("depth", sa.Text()))
        batch.add_column(sa.Column("positive", sa.JSON(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("negative", sa.JSON(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("source_name", sa.String(200)))
        batch.add_column(sa.Column("source_url", sa.Text()))
    # confidence (0001) is superseded by evidence_confidence; drop the redundant column.
    with op.batch_alter_table("species_evidence") as batch:
        batch.drop_column("confidence")

    # --- stocking ----------------------------------------------------------
    op.create_table(
        "stocking_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("location_id", sa.String(100), sa.ForeignKey("fishing_locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(80)),
        sa.Column("designation", sa.String(200)),
        sa.Column("species_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("source_url", sa.Text()),
        sa.Column("plan_url", sa.Text()),
        sa.Column("reviewed", sa.String(80)),
    )
    op.create_index("ix_stocking_records_location_id", "stocking_records", ["location_id"])

    # --- hydrology stations + associations ---------------------------------
    op.create_table(
        "hydrology_stations",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("monitor_url", sa.Text()),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("parameters", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.create_table(
        "location_station_associations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("location_id", sa.String(100), sa.ForeignKey("fishing_locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("station_id", sa.String(20), sa.ForeignKey("hydrology_stations.id"), nullable=False),
        sa.Column("relationship_type", sa.String(30), nullable=False),
        sa.Column("association_factor", sa.Float(), nullable=False),
        sa.Column("distance_miles", sa.Float()),
        sa.Column("basis", sa.Text()),
        sa.Column("limitation", sa.Text()),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("location_id", "station_id", name="uq_location_station"),
    )
    op.create_index("ix_location_station_associations_location_id", "location_station_associations", ["location_id"])
    op.create_index("ix_location_station_associations_station_id", "location_station_associations", ["station_id"])


def downgrade() -> None:
    op.drop_table("location_station_associations")
    op.drop_table("hydrology_stations")
    op.drop_table("stocking_records")
    with op.batch_alter_table("species_evidence") as batch:
        batch.add_column(sa.Column("confidence", sa.Float()))
        for column in (
            "modeled", "availability", "quality", "evidence_confidence", "evidence_summary",
            "last_evidence", "technique", "depth", "positive", "negative", "source_name", "source_url",
        ):
            batch.drop_column(column)
    op.drop_table("species_scoring_profiles")
    with op.batch_alter_table("species") as batch:
        batch.drop_column("aliases")
        batch.drop_column("habitat")
    op.drop_index("ix_fishing_location_aliases_alias", "fishing_location_aliases")
    op.drop_index("ix_fishing_location_aliases_location_id", "fishing_location_aliases")
    op.drop_table("fishing_location_aliases")
    op.drop_index("ix_fishing_locations_watershed", "fishing_locations")
    with op.batch_alter_table("fishing_locations") as batch:
        for column in (
            "waterbody_id", "waterbody_type", "watershed", "state", "access_methods", "distance_miles",
            "travel_minutes", "activity_estimate", "access_fit", "best_window", "flow_status", "notice",
            "access_authority", "access_source_url", "source_reviewed", "details",
        ):
            batch.drop_column(column)
    op.drop_table("waterbody_aliases")
    op.drop_table("waterbodies")
    op.drop_index("ix_data_ingestion_runs_started_at", "data_ingestion_runs")
    op.drop_index("ix_data_ingestion_runs_source_name", "data_ingestion_runs")
    op.drop_table("data_ingestion_runs")

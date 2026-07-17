import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const pipeline = path.join(scriptDirectory, "species_research_pipeline.py");
const candidates = [
  process.env.PYTHON,
  path.join(repositoryRoot, ".venv", "Scripts", "python.exe"),
  path.join(repositoryRoot, ".venv", "bin", "python"),
  "python3",
  "python",
].filter(Boolean);

for (const candidate of [...new Set(candidates)]) {
  const result = spawnSync(candidate, [pipeline, ...process.argv.slice(2)], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  if (result.error?.code === "ENOENT") {
    continue;
  }
  if (result.error) {
    console.error(`Unable to run the species research pipeline with ${candidate}:`);
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

console.error(
  "No Python runtime was found. Set PYTHON or create .venv before running this audit.",
);
process.exit(1);

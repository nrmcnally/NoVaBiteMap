#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(import.meta.dirname, "..");
const stateDirectory = path.join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
const migrationDirectory = path.join(root, "drizzle");

const databaseEntries = (await readdir(stateDirectory))
  .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
if (!databaseEntries.length) {
  throw new Error("No local D1 database found. Start `npm run dev` once, then rerun this command.");
}

const databases = await Promise.all(databaseEntries.map(async (name) => ({
  name,
  modified: (await stat(path.join(stateDirectory, name))).mtimeMs,
})));
databases.sort((a, b) => b.modified - a.modified);
const databasePath = path.join(stateDirectory, databases[0].name);

const migrationNames = (await readdir(migrationDirectory))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS __bitemap_local_migrations (
    name TEXT PRIMARY KEY NOT NULL,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`);

const applied = new Set(
  database.prepare("SELECT name FROM __bitemap_local_migrations").all().map((row) => row.name),
);
let count = 0;
for (const name of migrationNames) {
  if (applied.has(name)) continue;
  const source = await readFile(path.join(migrationDirectory, name), "utf8");
  // Drizzle's current BiteMap migrations are additive CREATE statements. IF NOT
  // EXISTS also makes this safe for a local database created before tracking was
  // added; hosted migration history remains managed by Sites, not this script.
  const idempotent = source
    .replaceAll("--> statement-breakpoint", "")
    .replace(/CREATE TABLE `(?!IF NOT EXISTS)/g, "CREATE TABLE IF NOT EXISTS `")
    .replace(/CREATE UNIQUE INDEX `(?!IF NOT EXISTS)/g, "CREATE UNIQUE INDEX IF NOT EXISTS `")
    .replace(/CREATE INDEX `(?!IF NOT EXISTS)/g, "CREATE INDEX IF NOT EXISTS `");
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(idempotent);
    database.prepare("INSERT INTO __bitemap_local_migrations (name) VALUES (?)").run(name);
    database.exec("COMMIT");
    count += 1;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
database.close();

console.log(`Local D1 ready: ${migrationNames.length} migrations known, ${count} applied.`);

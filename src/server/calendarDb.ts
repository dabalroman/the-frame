import Database from 'better-sqlite3';
import { readdirSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The Frame calendar store — SQLite (separate file from the image store).
 *
 * Scaffold scope (#183): connection + migrations infrastructure only. The
 * `migrations/` folder is empty, so opening a fresh DB just creates the
 * `schema_migrations` bookkeeping table. The events schema is added by #186 as
 * the first real migration.
 *
 * Migration files: `migrations/YYYYMMDDHHMMSS_slug.ts`, each exporting
 *   export const name: string            // must equal the filename stem
 *   export function up(db: Database): void
 */

export type DB = Database.Database;
export type Migration = { name: string; up: (db: DB) => void };

/** Read + validate migration modules from a directory (default: ./migrations). */
export function loadMigrations(dir?: string): Migration[] {
  const migrationsDir = dir ?? join(__dirname, 'migrations');
  const require = createRequire(import.meta.url);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort(); // ascending filename = chronological

  return files.map((file) => {
    const stem = basename(file, file.endsWith('.ts') ? '.ts' : '.js');
    const mod = require(join(migrationsDir, file)) as Migration;
    if (mod.name !== stem) {
      throw new Error(
        `Migration file mismatch: "${file}" exports name="${mod.name}" but expected "${stem}".`,
      );
    }
    return mod;
  });
}

/**
 * Apply pending migrations. Idempotent: already-applied names (tracked in
 * `schema_migrations`) are skipped. Wrapped in BEGIN IMMEDIATE so concurrent
 * openers serialise on the write lock instead of racing into duplicate inserts.
 * FKs are disabled during the loop so table-rebuild migrations don't cascade.
 */
export function runMigrations(db: DB, migrations: Migration[]): void {
  db.pragma('foreign_keys = OFF');
  db.pragma('busy_timeout = 5000');

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const onDiskNames = new Set(migrations.map((m) => m.name));
    const appliedRows = db
      .prepare('SELECT version, name FROM schema_migrations ORDER BY version')
      .all() as { version: number; name: string }[];
    const appliedNames = new Set(appliedRows.map((r) => r.name));

    // Downgrade guard: an applied name with no file on disk means newer code ran.
    const missing = [...appliedNames].filter((n) => !onDiskNames.has(n));
    if (missing.length > 0) {
      throw new Error(
        `DB migrated by newer code; downgrade not supported. Missing files: ${missing.join(', ')}`,
      );
    }

    const insert = db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)');
    let nextVersion = appliedRows.length + 1;
    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) continue;
      migration.up(db);
      insert.run(nextVersion, migration.name);
      nextVersion++;
    }

    const count = (db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number }).n;
    db.pragma(`user_version = ${count}`);
  })();

  // Surface any FK violations introduced while FKs were off.
  const violations = db.pragma('foreign_key_check') as unknown[];
  if (violations.length > 0) {
    throw new Error(`Foreign key violations after migration: ${JSON.stringify(violations)}`);
  }
  db.pragma('foreign_keys = ON');
}

export type CalendarStoreOptions = { dbPath: string };

export function createCalendarStore({ dbPath }: CalendarStoreOptions) {
  const db = new Database(dbPath);
  // DELETE journaling (not WAL): WAL's mmap'd shm region isn't coherent across
  // bind mounts / namespaces. DELETE coordinates via POSIX locks instead.
  db.pragma('journal_mode = DELETE');
  db.pragma('busy_timeout = 5000');

  try {
    runMigrations(db, loadMigrations());
  } finally {
    db.pragma('foreign_keys = ON');
  }

  function close(): void {
    db.close();
  }

  return { db, close };
}

export type CalendarStore = ReturnType<typeof createCalendarStore>;

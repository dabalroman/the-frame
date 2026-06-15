import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, type DB, type Migration } from './calendarDb';

function freshDb(): DB {
  const db = new Database(':memory:');
  db.pragma('journal_mode = MEMORY');
  return db;
}

let db: DB | undefined;
afterEach(() => {
  db?.close();
  db = undefined;
});

function migrationNames(database: DB): string[] {
  return (database.prepare('SELECT name FROM schema_migrations ORDER BY version').all() as { name: string }[])
    .map((r) => r.name);
}

describe('runMigrations', () => {
  it('creates an empty schema_migrations table when there are no migrations', () => {
    db = freshDb();
    runMigrations(db, []);
    expect(migrationNames(db)).toEqual([]);
    // user_version tracks the applied count.
    expect(db.pragma('user_version', { simple: true })).toBe(0);
  });

  it('applies migrations in order and records them', () => {
    db = freshDb();
    const applied: string[] = [];
    const migrations: Migration[] = [
      { name: '20260101000000_a', up: (d) => { d.exec('CREATE TABLE a (id INTEGER)'); applied.push('a'); } },
      { name: '20260101000001_b', up: (d) => { d.exec('CREATE TABLE b (id INTEGER)'); applied.push('b'); } },
    ];
    runMigrations(db, migrations);
    expect(applied).toEqual(['a', 'b']);
    expect(migrationNames(db)).toEqual(['20260101000000_a', '20260101000001_b']);
    expect(db.pragma('user_version', { simple: true })).toBe(2);
  });

  it('is idempotent — re-running applies nothing new', () => {
    db = freshDb();
    let runs = 0;
    const migrations: Migration[] = [
      { name: '20260101000000_a', up: (d) => { d.exec('CREATE TABLE a (id INTEGER)'); runs++; } },
    ];
    runMigrations(db, migrations);
    runMigrations(db, migrations);
    expect(runs).toBe(1);
    expect(migrationNames(db)).toEqual(['20260101000000_a']);
  });

  it('rejects a downgrade (applied name with no file on disk)', () => {
    db = freshDb();
    runMigrations(db, [{ name: '20260101000000_a', up: (d) => d.exec('CREATE TABLE a (id INTEGER)') }]);
    expect(() => runMigrations(db!, [])).toThrow(/downgrade not supported/);
  });
});

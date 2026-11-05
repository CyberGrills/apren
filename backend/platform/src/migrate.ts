import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createPool, one, transaction } from './db.ts';
import type { Pool } from 'pg';

export async function migrate(pool: Pool): Promise<void> {
  const directory = new URL('../../../database/migrations/', import.meta.url);
  for (const filename of (await readdir(directory))
    .filter((value) => /^\d+.*\.sql$/.test(value))
    .sort()) {
    const sql = await readFile(new URL(filename, directory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    await transaction(pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('seven:migrations'))");
      const exists = await one(client, "SELECT to_regclass('seven.migrations') AS table_name");
      const previous = exists?.table_name
        ? await one(client, 'SELECT checksum FROM seven.migrations WHERE migration_name=$1', [
            filename,
          ])
        : undefined;
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error(`Migration checksum changed: ${filename}`);
        return;
      }
      await client.query(sql);
      await client.query(`CREATE TABLE IF NOT EXISTS seven.migrations (
        migration_id bigint GENERATED ALWAYS AS IDENTITY,
        migration_name varchar(180) NOT NULL, checksum varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT migrations_pk PRIMARY KEY(migration_id), CONSTRAINT migrations_name_uk UNIQUE(migration_name));
        ALTER TABLE seven.migrations OWNER TO seven_owner;
        GRANT SELECT ON seven.migrations TO seven_app, seven_readonly;
        COMMENT ON TABLE seven.migrations IS 'Applied immutable migration names and SHA-256 checksums.';`);
      await client.query('INSERT INTO seven.migrations(migration_name,checksum) VALUES($1,$2)', [
        filename,
        checksum,
      ]);
    });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(fileURLToPath(pathToFileURL(process.argv[1]))).href
) {
  const pool = createPool(process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL);
  try {
    await migrate(pool);
    console.log('7even migrations applied.');
  } finally {
    await pool.end();
  }
}

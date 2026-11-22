import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { auditMigrationHistory } from '../../scripts/check-migration-history.mjs';

async function fixture(t, files) {
  const directory = await mkdtemp(join(tmpdir(), '7even-migrations-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(directory, name), content);
  }
  return directory;
}

const checksum = (value) => createHash('sha256').update(value).digest('hex');

test('repository migration directory has no unapproved duplicate sequence numbers', async () => {
  const directory = new URL('../../database/migrations/', import.meta.url);
  const result = await auditMigrationHistory({ directory: directory.pathname });
  assert.equal(result.ok, true, result.errors.join('\\n'));
  assert.ok(result.filenames.length > 0);
});

test('permits only the exact historical 033 duplicate pair', async (t) => {
  const directory = await fixture(t, {
    '033_creator_artwork_foundation.sql': 'select 1;',
    '033_customer_profile_media.sql': 'select 2;',
  });
  const result = await auditMigrationHistory({ directory });
  assert.equal(result.ok, true, result.errors.join('\\n'));
});

test('rejects newly introduced duplicate sequence numbers', async (t) => {
  const directory = await fixture(t, {
    '033_creator_artwork_foundation.sql': 'select 1;',
    '033_customer_profile_media.sql': 'select 2;',
    '033_new_unapproved_migration.sql': 'select 3;',
  });
  const result = await auditMigrationHistory({ directory });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Duplicate migration sequence 033/);
});

test('rejects an applied ledger entry whose source file is missing', async (t) => {
  const directory = await fixture(t, { '001_initial.sql': 'select 1;' });
  const result = await auditMigrationHistory({
    directory,
    ledger: [{ migration_name: '010_function_search_path.sql', checksum: 'a'.repeat(64) }],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Applied migration source is missing/);
});

test('rejects a checksum mismatch for an existing applied migration', async (t) => {
  const directory = await fixture(t, { '001_initial.sql': 'select 1;' });
  const result = await auditMigrationHistory({
    directory,
    ledger: [{ migration_name: '001_initial.sql', checksum: 'a'.repeat(64) }],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Migration checksum mismatch/);
});

test('accepts an applied ledger entry with an exact source checksum', async (t) => {
  const content = 'select 1;';
  const directory = await fixture(t, { '001_initial.sql': content });
  const result = await auditMigrationHistory({
    directory,
    ledger: [{ migration_name: '001_initial.sql', checksum: checksum(content) }],
  });
  assert.equal(result.ok, true, result.errors.join('\\n'));
});

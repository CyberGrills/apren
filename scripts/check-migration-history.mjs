import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const allowedLegacyDuplicate = new Map([
  ['033', new Set(['033_creator_artwork_foundation.sql', '033_customer_profile_media.sql'])],
]);

export async function auditMigrationHistory({ directory, ledger = [] }) {
  const filenames = (await readdir(directory))
    .filter((name) => /^\\d+.*\\.sql$/.test(name))
    .sort();
  const errors = [];
  const byPrefix = new Map();

  for (const filename of filenames) {
    const match = /^(\\d+).*\\.sql$/.exec(filename);
    if (!match) continue;
    const prefix = match[1];
    const names = byPrefix.get(prefix) ?? [];
    names.push(filename);
    byPrefix.set(prefix, names);
  }

  for (const [prefix, names] of byPrefix) {
    if (names.length < 2) continue;
    const allowed = allowedLegacyDuplicate.get(prefix);
    const exactLegacyPair =
      allowed &&
      names.length === allowed.size &&
      names.every((name) => allowed.has(name));
    if (!exactLegacyPair) {
      errors.push(`Duplicate migration sequence ${prefix}: ${names.join(', ')}`);
    }
  }

  const sourceByName = new Map();
  for (const filename of filenames) {
    const content = await readFile(resolve(directory, filename));
    sourceByName.set(filename, createHash('sha256').update(content).digest('hex'));
  }

  for (const entry of ledger) {
    if (!entry || typeof entry.migration_name !== 'string' || typeof entry.checksum !== 'string') {
      errors.push('Invalid ledger entry: expected migration_name and checksum strings.');
      continue;
    }
    const actual = sourceByName.get(entry.migration_name);
    if (!actual) {
      errors.push(`Applied migration source is missing: ${entry.migration_name}`);
      continue;
    }
    if (!/^[a-f0-9]{64}$/i.test(entry.checksum)) {
      errors.push(`Invalid SHA-256 checksum in ledger: ${entry.migration_name}`);
      continue;
    }
    if (actual !== entry.checksum.toLowerCase()) {
      errors.push(`Migration checksum mismatch: ${entry.migration_name}`);
    }
  }

  return { ok: errors.length === 0, filenames, errors };
}

async function main() {
  const args = process.argv.slice(2);
  const ledgerIndex = args.indexOf('--ledger');
  if (ledgerIndex !== -1 && !args[ledgerIndex + 1]) {
    throw new Error('--ledger requires a JSON file path.');
  }
  const directoryIndex = args.indexOf('--directory');
  const directory = resolve(
    directoryIndex === -1
      ? new URL('../database/migrations/', import.meta.url).pathname
      : args[directoryIndex + 1],
  );
  const ledger = ledgerIndex === -1
    ? []
    : JSON.parse(await readFile(resolve(args[ledgerIndex + 1]), 'utf8'));
  if (!Array.isArray(ledger)) throw new Error('Migration ledger JSON must be an array.');

  const result = await auditMigrationHistory({ directory, ledger });
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  if (!result.ok) process.exitCode = 1;
  else console.log(`Migration history checks passed (${result.filenames.length} source files).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

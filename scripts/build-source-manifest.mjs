import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/7even/evidence/payments-source-manifest.json';
const activePrefixes = [
  'apps/web/',
  'database/',
  'packages/',
  'scripts/',
  'services/apren-engine/',
  'services/platform/',
  'tests/',
  '.github/workflows/',
];
const namedFiles = new Set(['.env.example', 'biome.json', 'package.json', 'package-lock.json', 'tsconfig.json']);
const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((path) => !path.startsWith('docs/'))
  .filter((path) => !path.startsWith('legacy/'))
  .filter((path) => !/(^|\/)(node_modules|dist|coverage|\.git)(\/|$)/.test(path))
  .filter((path) => !/(^|\/)(\.env|\.env\.[^/]+)$/.test(path) || path === '.env.example')
  .filter((path) => !/\.(sqlite|db)$/.test(path))
  .filter((path) => namedFiles.has(path) || activePrefixes.some((prefix) => path.startsWith(prefix)))
  .sort();

const hash = createHash('sha256');
for (const path of paths) {
  hash.update(path, 'utf8');
  hash.update(Buffer.from([0]));
  hash.update(readFileSync(resolve(root, path)));
  hash.update(Buffer.from([0]));
}

const current = JSON.parse(readFileSync(resolve(root, manifestPath), 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const output = {
  baseCommit: commit,
  branch: 'main',
  date: new Date().toISOString().slice(0, 10),
  algorithm: 'SHA-256 of sorted unique relative path + NUL + file bytes + NUL',
  scope: 'All tracked active source, public assets, migrations, tests, scripts, workflow and named root/workspace configuration files; excludes node_modules/dist/coverage, local/private state, historical legacy source and documentation.',
  files: paths.length,
  sha256: hash.digest('hex'),
  paths,
};
writeFileSync(resolve(root, manifestPath), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ baseCommit: commit, files: output.files, sha256: output.sha256 }, null, 2));

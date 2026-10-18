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

const dirtySource = execFileSync(
  'git',
  ['status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude)docs/**'],
  { cwd: root, encoding: 'utf8' },
).trim();
if (dirtySource) {
  throw new Error('Commit active source/configuration changes before generating the source manifest.');
}

const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((path) => !path.split('/').some((segment) => ['node_modules', 'dist', 'coverage', '.git'].includes(segment)))
  .filter((path) => !path.startsWith('docs/'))
  .filter((path) => !path.startsWith('legacy/'))
  .filter((path) => {
    const fileName = path.split('/').at(-1);
    return !(fileName === '.env' || fileName.startsWith('.env.')) || path === '.env.example';
  })
  .filter((path) => !path.endsWith('.sqlite') && !path.endsWith('.db'))
  .filter((path) => namedFiles.has(path) || activePrefixes.some((prefix) => path.startsWith(prefix)))
  .sort();

const hash = createHash('sha256');
for (const path of paths) {
  hash.update(path, 'utf8');
  hash.update(Buffer.from([0]));
  hash.update(readFileSync(resolve(root, path)));
  hash.update(Buffer.from([0]));
}

const sourceCommit = execFileSync(
  'git',
  ['log', '-1', '--format=%H', '--', '.', ':(exclude)docs/**'],
  { cwd: root, encoding: 'utf8' },
).trim();
const output = {
  sourceCommit,
  generatedFor: 'main',
  date: new Date().toISOString().slice(0, 10),
  algorithm: 'SHA-256 of sorted unique relative path + NUL + file bytes + NUL',
  scope: 'All tracked active source, public assets, migrations, tests, scripts, workflows and named root/workspace configuration files; excludes node_modules/dist/coverage, local/private state, historical legacy source and documentation.',
  files: paths.length,
  sha256: hash.digest('hex'),
  paths,
};
writeFileSync(resolve(root, manifestPath), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ sourceCommit, files: output.files, sha256: output.sha256 }, null, 2));

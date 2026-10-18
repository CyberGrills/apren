import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(repoRoot, 'vercel.json'), 'utf8'));
const errors = [];

if (!config.services || typeof config.services !== 'object') {
  errors.push('vercel.json must define a services object.');
}
const services = config.services ?? {};
for (const [name, service] of Object.entries(services)) {
  if (!service.root) {
    errors.push(`Service "${name}" is missing root.`);
    continue;
  }
  if (!existsSync(resolve(repoRoot, service.root))) {
    errors.push(`Service "${name}" root does not exist: ${service.root}`);
  }
  if (service.entrypoint && !existsSync(resolve(repoRoot, service.root, service.entrypoint))) {
    errors.push(`Service "${name}" entrypoint does not exist: ${service.root}/${service.entrypoint}`);
  }
  for (const pattern of service.includeFiles ?? []) {
    const literalPrefix = pattern.split(/[*?{[]/, 1)[0].replace(/\/$/, '');
    if (literalPrefix && !existsSync(resolve(repoRoot, service.root, literalPrefix))) {
      errors.push(`Service "${name}" includeFiles path does not exist: ${pattern}`);
    }
  }
  for (const binding of service.bindings ?? []) {
    if (binding.type !== 'service' || binding.format !== 'url' || !binding.env) {
      errors.push(`Service "${name}" has an invalid binding definition.`);
    }
    if (!services[binding.service]) {
      errors.push(`Service "${name}" binds to unknown service "${binding.service}".`);
    }
  }
}

const publicRewrites = config.rewrites ?? [];
for (const rewrite of publicRewrites) {
  const target = rewrite.destination?.service;
  if (!target || !services[target]) {
    errors.push(`Public rewrite must target a declared service; invalid destination for ${rewrite.source}.`);
  }
}
if (!publicRewrites.length || publicRewrites.some((rewrite) => rewrite.destination?.service !== 'web')) {
  errors.push('Preview policy requires every public rewrite to target only the web service.');
}
if (!services.web) errors.push('The web service is required.');
if (!services.platform) errors.push('The active platform service is required.');

if (errors.length) {
  console.error('Vercel Services validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Vercel Services config valid: ${Object.keys(services).length} services; public ingress targets web only.`);
}

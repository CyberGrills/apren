import { runProductionSmoke } from './production-smoke-lib.mjs';

const report = await runProductionSmoke();

for (const result of report.results) {
  const output = `${result.status} ${result.name}: ${result.detail}`;
  if (result.status === 'FAIL') console.error(output);
  else if (result.status === 'WARN') console.warn(output);
  else console.log(output);
}

console.log(JSON.stringify(report));

if (report.failureCount > 0) process.exitCode = 1;

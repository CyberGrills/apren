import { spawn } from 'node:child_process';

const runtimeEnv = {
  ...process.env,
};
const services = [
  spawn(process.execPath, ['services/platform/src/server.ts'], { stdio: 'inherit', env: runtimeEnv }),
];
let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const service of services) if (service.exitCode === null) service.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
for (const service of services) service.on('exit', (code) => { if (!closing) shutdown(code ?? 1); });

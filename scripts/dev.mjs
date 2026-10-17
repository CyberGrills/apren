import { spawn } from 'node:child_process';

const services = [
  spawn(process.execPath, ['--watch', 'services/platform/src/server.ts'], { stdio: 'inherit', env: process.env }),
  spawn('npm', ['--workspace', '@7even/web', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5177', '--strictPort'], { stdio: 'inherit', env: process.env }),
];
let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const service of services) service.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
for (const service of services) service.on('exit', (code) => shutdown(code ?? 1));

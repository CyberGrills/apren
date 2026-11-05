import { createApp } from './app.ts';
import { runRecovery } from './worker.ts';

const runtime = createApp();
const port = Number(process.env.PORT ?? 7077);
const server = runtime.app.listen(port, '0.0.0.0', () =>
  console.log(`7even API listening on port ${port}. Payment mode: ${runtime.provider.mode}.`),
);
let running = false;
const worker = setInterval(() => {
  if (running) return;
  running = true;
  void runRecovery(runtime.pool, runtime.provider)
    .catch((error) =>
      console.error('7even recovery worker:', error instanceof Error ? error.message : 'Failed'),
    )
    .finally(() => {
      running = false;
    });
}, 15000);
worker.unref();
async function shutdown() {
  clearInterval(worker);
  server.close();
  await runtime.pool.end();
}
process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});

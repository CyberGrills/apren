import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createApp } from '../../services/platform/src/app.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('Apren engine service boundary', () => {
  it('starts independently and exposes a health contract', async () => {
    const child = spawn(process.execPath, ['services/apren-engine/src/server.js'], {
      cwd: root,
      env: { ...process.env, APREN_ENGINE_PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let stderr = '';
    let port;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/Apren engine listening on (\d+)/);
      if (match) port = Number(match[1]);
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    try {
      const deadline = Date.now() + 15000;
      while (!port && Date.now() < deadline && child.exitCode === null) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
      }
      assert.ok(port, `engine did not start; stdout=${output}; stderr=${stderr}`);
      const engineUrl = `http://127.0.0.1:${port}`;
      const response = await fetch(`${engineUrl}/healthz`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        service: 'apren-engine',
        status: 'ok',
        capabilities: ['food-assets', 'food-intelligence', 'food-economy', 'food-brain'],
      });

      const verificationAssetId = '980000001';
      const verificationResponse = await fetch(`${engineUrl}/verify/${verificationAssetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'image', file: 'evidence-ref:route-test' }),
      });
      assert.equal(verificationResponse.status, 200);
      const verificationPayload = await verificationResponse.json();
      assert.equal(verificationPayload.verification.status, 'REVIEW_REQUIRED');
      assert.equal(verificationPayload.verification.verified, false);
      assert.equal(verificationPayload.verification.confidence, null);

      const lifecycleResponse = await fetch(`${engineUrl}/lifecycle/${verificationAssetId}`);
      assert.equal(lifecycleResponse.status, 200);
      const lifecyclePayload = await lifecycleResponse.json();
      assert.ok(lifecyclePayload.events.some((event) => event.event_type === 'VERIFICATION_REVIEW_REQUIRED'));
      assert.equal(lifecyclePayload.events.some((event) => event.event_type === 'VERIFIED'), false);

      const previousEngineUrl = process.env.APREN_ENGINE_URL;
      process.env.APREN_ENGINE_URL = engineUrl;
      const runtime = createApp({ pool: {}, provider: new MockProvider(), environment: 'test', publicOrigin: 'http://127.0.0.1' });
      const platformServer = runtime.app.listen(0, '127.0.0.1');
      try {
        await once(platformServer, 'listening');
        const address = platformServer.address();
        assert.ok(address && typeof address === 'object');
        const platformResponse = await fetch(`http://127.0.0.1:${address.port}/api/engine/apren/health`);
        assert.equal(platformResponse.status, 200);
        assert.deepEqual(await platformResponse.json(), { data: { engine: 'apren', status: 'ok' } });
      } finally {
        await new Promise((resolvePromise, rejectPromise) => platformServer.close((error) => error ? rejectPromise(error) : resolvePromise()));
        if (previousEngineUrl === undefined) delete process.env.APREN_ENGINE_URL;
        else process.env.APREN_ENGINE_URL = previousEngineUrl;
      }
    } finally {
      child.kill('SIGTERM');
      if (child.exitCode === null) await Promise.race([once(child, 'exit'), new Promise((resolvePromise) => setTimeout(resolvePromise, 2000))]);
    }
  });
});

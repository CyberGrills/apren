import assert from 'node:assert/strict';
import test from 'node:test';
import { runProductionSmoke } from './production-smoke-lib.mjs';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function makeFetch({ inventory = [], authStatus = 200, livePaymentsReady = false } = {}) {
  const readyBody = {
    data: {
      status: 'ready',
      storage: 'postgresql',
      payments: {
        mode: 'live',
        fiatReady: livePaymentsReady,
        missingRequiredConfiguration: livePaymentsReady
          ? []
          : ['PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_WEBHOOK_SECRET'],
      },
    },
  };

  return async (input) => {
    const url = new URL(input);
    const key = `${url.pathname}${url.search}`;
    switch (key) {
      case '/api/health/live':
        return response({ data: { status: 'ok' } });
      case '/api/health/ready':
        return response(readyBody);
      case '/api/auth/session':
        return response({ data: { user: null } }, authStatus);
      case '/api/offerings?kind=STAY&pageSize=3':
        return response({ data: inventory });
      case '/api/directory?kind=STAY&pageSize=20':
        return response({
          data: {
            states: Array.from({ length: 37 }, (_, index) => ({ stateName: `State ${index + 1}` })),
            listings: [],
          },
        });
      default:
        throw new Error(`Unexpected smoke request: ${key}`);
    }
  };
}

test('operational smoke passes while unmet payment and inventory launch gates remain visible as warnings', async () => {
  const report = await runProductionSmoke({
    baseUrl: 'https://example.test',
    fetchImpl: makeFetch(),
  });

  assert.equal(report.failureCount, 0);
  assert.equal(report.warningCount, 2);
  assert.equal(report.launchReadinessRequired, false);
  assert.deepEqual(
    report.results.filter((result) => result.status === 'WARN').map((result) => result.name),
    ['live payment readiness', 'published hotel inventory'],
  );
  assert.match(report.warnings[0].reason, /PAYSTACK_SECRET_KEY/);
  assert.match(report.warnings[1].reason, /no published bookable hotels/);
});

test('explicit launch-readiness mode promotes payment and inventory blockers to failures', async () => {
  const report = await runProductionSmoke({
    baseUrl: 'https://example.test',
    requireLaunchReadiness: true,
    fetchImpl: makeFetch(),
  });

  assert.equal(report.failureCount, 2);
  assert.equal(report.warningCount, 0);
  assert.equal(report.launchReadinessRequired, true);
  assert.deepEqual(
    report.results.filter((result) => result.status === 'FAIL').map((result) => result.name),
    ['live payment readiness', 'published hotel inventory'],
  );
});

test('operational API failures remain failures even when launch readiness is optional', async () => {
  const report = await runProductionSmoke({
    baseUrl: 'https://example.test',
    fetchImpl: makeFetch({ authStatus: 503 }),
  });

  assert.equal(report.failureCount, 1);
  assert.equal(report.warningCount, 2);
  assert.equal(report.results.find((result) => result.name === 'auth session')?.status, 'FAIL');
});

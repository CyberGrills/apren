export async function runProductionSmoke({
  baseUrl = process.env.SEVEN_PRODUCTION_URL ?? 'https://apren.vercel.app',
  timeoutMs = 10_000,
  requireLaunchReadiness = process.env.SEVEN_REQUIRE_LAUNCH_READINESS === 'true',
  fetchImpl = globalThis.fetch,
} = {}) {
  const failures = [];
  const warnings = [];
  const results = [];

  async function getJson(path) {
    let response;
    try {
      response = await fetchImpl(new URL(path, baseUrl), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      });
    } catch (error) {
      throw new Error(`request failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) throw new Error('unexpected content type');
    try {
      return await response.json();
    } catch {
      throw new Error('invalid JSON response');
    }
  }

  function record(name, path, validate, { launchGate = false } = {}) {
    try {
      const detail = validate();
      results.push({ name, status: 'PASS', detail });
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      const item = { name, path, reason };
      if (launchGate && !requireLaunchReadiness) {
        warnings.push(item);
        results.push({ name, status: 'WARN', detail: reason });
      } else {
        failures.push(item);
        results.push({ name, status: 'FAIL', detail: reason });
      }
      return false;
    }
  }

  async function check(name, path, validate, options) {
    try {
      const body = await getJson(path);
      record(name, path, () => validate(body), options);
      return body;
    } catch (error) {
      record(name, path, () => {
        throw error;
      }, options);
      return null;
    }
  }

  await check('liveness', '/api/health/live', (body) => {
    if (body?.data?.status !== 'ok') throw new Error('unexpected liveness payload');
    return 'service is alive';
  });

  const readiness = await check('database readiness', '/api/health/ready', (body) => {
    if (body?.data?.status !== 'ready' || body?.data?.storage !== 'postgresql') {
      throw new Error('database readiness payload is not ready');
    }
    return 'database and migration ledger reachable';
  });

  if (readiness) {
    record('live payment readiness', '/api/health/ready', () => {
      const payments = readiness?.data?.payments;
      if (!payments || payments.mode !== 'live' || payments.fiatReady !== true) {
        const missing = Array.isArray(payments?.missingRequiredConfiguration)
          ? payments.missingRequiredConfiguration.join(', ')
          : 'payment readiness diagnostics unavailable';
        throw new Error('live fiat checkout is not ready; missing or invalid configuration: ' + missing);
      }
      return 'Paystack and Flutterwave live adapters are configured';
    }, { launchGate: true });
  }

  await check('auth session', '/api/auth/session', (body) => {
    if (!body || typeof body.data !== 'object' || !Object.hasOwn(body.data, 'user')) {
      throw new Error('session response contract changed');
    }
    return 'session endpoint responds with expected anonymous/authenticated shape';
  });

  await check('published hotel inventory', '/api/offerings?kind=STAY&pageSize=3', (body) => {
    if (!Array.isArray(body?.data)) throw new Error('published hotel inventory data is not an array');
    if (body.data.length === 0) {
      throw new Error('no published bookable hotels; partner onboarding and fresh room confirmation are required');
    }
    return `${body.data.length} bookable hotel offering(s) returned`;
  }, { launchGate: true });

  await check('stay directory API', '/api/directory?kind=STAY&pageSize=20', (body) => {
    const data = body?.data;
    if (!Array.isArray(data?.states) || !Array.isArray(data?.listings)) {
      throw new Error('directory response contract changed');
    }
    if (data.states.length < 37) {
      throw new Error(`expected at least 37 state/FCT rows; received ${data.states.length}`);
    }
    return `${data.states.length} state/FCT rows; ${data.listings.length} stay leads`;
  });

  return {
    baseUrl,
    checkedAt: new Date().toISOString(),
    launchReadinessRequired: requireLaunchReadiness,
    results,
    warnings,
    failureCount: failures.length,
    warningCount: warnings.length,
  };
}

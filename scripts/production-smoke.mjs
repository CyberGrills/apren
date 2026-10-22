const baseUrl = process.env.SEVEN_PRODUCTION_URL ?? 'https://apren.vercel.app';
const timeoutMs = 10_000;
const failures = [];
const warnings = [];
const results = [];

async function getJson(path) {
  let response;
  try {
    response = await fetch(new URL(path, baseUrl), {
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

async function check(name, path, validate) {
  try {
    const body = await getJson(path);
    const detail = validate(body);
    results.push({ name, status: 'PASS', detail });
    console.log(`PASS ${name}: ${detail}`);
    return body;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    failures.push({ name, path, reason });
    results.push({ name, status: 'FAIL', detail: reason });
    console.error(`FAIL ${name} (${path}): ${reason}`);
    return null;
  }
}

await check('liveness', '/api/health/live', (body) => {
  if (body?.data?.status !== 'ok') throw new Error('unexpected liveness payload');
  return 'service is alive';
});

await check('database readiness', '/api/health/ready', (body) => {
  if (body?.data?.status !== 'ready' || body?.data?.storage !== 'postgresql') {
    throw new Error('database readiness payload is not ready');
  }
  return 'database and migration ledger reachable';
});

await check('live payment readiness', '/api/health/ready', (body) => {
  const payments = body?.data?.payments;
  if (!payments || payments.mode !== 'live' || payments.fiatReady !== true) {
    const missing = Array.isArray(payments?.missingRequiredConfiguration)
      ? payments.missingRequiredConfiguration.join(', ')
      : 'payment readiness diagnostics unavailable';
    throw new Error('live fiat checkout is not ready; missing or invalid configuration: ' + missing);
  }
  return 'Paystack and Flutterwave live adapters are configured';
});

await check('auth session', '/api/auth/session', (body) => {
  if (!body || typeof body.data !== 'object' || !Object.hasOwn(body.data, 'user')) {
    throw new Error('session response contract changed');
  }
  return 'session endpoint responds with expected anonymous/authenticated shape';
});

const offerings = await check('offerings API', '/api/offerings?pageSize=3', (body) => {
  if (!Array.isArray(body?.data)) throw new Error('offerings data is not an array');
  if (body.data.length === 0) warnings.push('No published bookable offerings; hotel onboarding is required.');
  return `${body.data.length} offering(s) returned`;
});

const directory = await check('stay directory API', '/api/directory?kind=STAY&pageSize=20', (body) => {
  const data = body?.data;
  if (!Array.isArray(data?.states) || !Array.isArray(data?.listings)) {
    throw new Error('directory response contract changed');
  }
  if (data.states.length < 37) throw new Error(`expected at least 37 state/FCT rows; received ${data.states.length}`);
  return `${data.states.length} state/FCT rows; ${data.listings.length} stay leads`;
});

for (const warning of warnings) console.warn(`WARN ${warning}`);
console.log(JSON.stringify({ baseUrl, checkedAt: new Date().toISOString(), results, warnings, failureCount: failures.length }));

if (failures.length > 0) process.exitCode = 1;

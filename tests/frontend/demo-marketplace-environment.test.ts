import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import type * as C from '@7even/contracts';
import { mountDemoMarketplace } from '../../services/platform/src/demoMarketplace.ts';

type Registration = { method: 'get' | 'post'; path: string };

function routeRecorder(): { app: Express; registrations: Registration[] } {
  const registrations: Registration[] = [];
  const app = {
    get(path: string, ..._handlers: unknown[]) {
      registrations.push({ method: 'get', path });
      return app;
    },
    post(path: string, ..._handlers: unknown[]) {
      registrations.push({ method: 'post', path });
      return app;
    },
  };
  return { app: app as unknown as Express, registrations };
}

const unusedPool = {} as Pool;
const unusedActor = ((_res: Response) => {
  throw new Error('Route registration must not resolve a session actor.');
}) as (res: Response) => C.SessionUser;

test('demo marketplace API routes are not mounted in Production', () => {
  const { app, registrations } = routeRecorder();

  mountDemoMarketplace(app, unusedPool, unusedActor, 'production');

  assert.deepEqual(registrations, []);
});

test('demo marketplace API routes remain mounted in Preview', () => {
  const { app, registrations } = routeRecorder();

  mountDemoMarketplace(app, unusedPool, unusedActor, 'preview');

  assert.deepEqual(registrations, [
    { method: 'get', path: '/api/demo/catalog' },
    { method: 'get', path: '/api/demo/wallet' },
    { method: 'get', path: '/api/demo/bookings' },
    { method: 'post', path: '/api/demo/bookings' },
    { method: 'post', path: '/api/demo/bookings/:id/cancel' },
  ]);
});

test('demo marketplace API routes remain mounted in local development', () => {
  const { app, registrations } = routeRecorder();

  mountDemoMarketplace(app, unusedPool, unusedActor, 'development');

  assert.equal(registrations.length, 5);
  assert.ok(registrations.some((route) => route.path === '/api/demo/catalog'));
});

test('production homepage does not advertise the fictional demo catalogue', async () => {
  const landingPage = await readFile(
    new URL('../../apps/web/src/pages/public/LandingPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    landingPage,
    /\{!import\.meta\.env\.PROD\s*&&\s*\(\s*<section className="public-container demo-catalog-entry"/s,
  );
});

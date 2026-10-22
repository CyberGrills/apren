import assert from 'node:assert/strict';
import test from 'node:test';
import { loginPathForWorkspace, safeWorkspaceReturnTo } from './workspaceNavigation.ts';

test('staff access keeps the original admin destination behind its direct login link', () => {
  assert.equal(loginPathForWorkspace(['ADMIN']), '/admin/login');
  assert.equal(loginPathForWorkspace(['BUSINESS_OWNER']), '/login');
  assert.equal(loginPathForWorkspace(), '/login');
  assert.equal(
    safeWorkspaceReturnTo('/admin/payments?status=UNKNOWN', true),
    '/admin/payments?status=UNKNOWN',
  );
  assert.equal(safeWorkspaceReturnTo(null, true), '/admin');
  assert.equal(safeWorkspaceReturnTo('/admin/login', true), '/admin');
  assert.equal(safeWorkspaceReturnTo('/admin/login?returnTo=%2Fadmin', true), '/admin');
  assert.equal(safeWorkspaceReturnTo('/admin/../business', true), '/admin');
  assert.equal(safeWorkspaceReturnTo('/business', true), '/admin');
});

test('workspace return paths reject external destinations and keep valid customer paths', () => {
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/\n/evil', '']) {
    assert.equal(safeWorkspaceReturnTo(value), '/workspace');
    assert.equal(safeWorkspaceReturnTo(value, true), '/admin');
  }
  assert.equal(safeWorkspaceReturnTo('/business/apply'), '/business/apply');
  assert.equal(safeWorkspaceReturnTo('/explore?kind=STAY'), '/explore?kind=STAY');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflowFiles = [
  {
    path: '../../.github/workflows/frontend-ci.yml',
    actions: ['actions/checkout@v5', 'actions/setup-node@v5'],
  },
  {
    path: '../../.github/workflows/unified-system-ci.yml',
    actions: ['actions/checkout@v5', 'actions/setup-node@v5'],
  },
  {
    path: '../../.github/workflows/production-smoke.yml',
    actions: ['actions/checkout@v5', 'actions/github-script@v8'],
  },
];

test('repository workflows use Node 24-compatible JavaScript actions', () => {
  for (const workflow of workflowFiles) {
    const content = readFileSync(new URL(workflow.path, import.meta.url), 'utf8');
    for (const action of workflow.actions) {
      assert.ok(
        content.includes(`uses: ${action}`) || content.includes(`- uses: ${action}`),
        `${workflow.path} must use ${action}`,
      );
    }
  }
});

test('frontend CI covers pull requests targeting stacked feature branches', () => {
  const content = readFileSync(
    new URL('../../.github/workflows/frontend-ci.yml', import.meta.url),
    'utf8',
  );
  const pullRequestSection = content
    .split(/^  pull_request:\s*$/m)[1]
    ?.split(/^  [A-Za-z_][\w-]*:\s*$/m)[0];

  assert.ok(pullRequestSection !== undefined, 'frontend CI must declare pull_request');
  assert.doesNotMatch(
    pullRequestSection,
    /^\s{4}branches\s*:/m,
    'frontend CI must not restrict PRs to main; stacked PRs also need frontend validation',
  );
});

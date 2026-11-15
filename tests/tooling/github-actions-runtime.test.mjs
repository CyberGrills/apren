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

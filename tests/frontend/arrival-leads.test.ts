import assert from 'node:assert/strict';
import test from 'node:test';
import { arrivalDiscoveryLeads } from '../../apps/web/src/lib/arrivalLeads.ts';

const normalize = (name: string): string => name.toLocaleLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

test('arrival discovery merges the curated and unique Uyo directory leads', () => {
  assert.equal(arrivalDiscoveryLeads.length, 239);
  assert.equal(new Set(arrivalDiscoveryLeads.map((lead) => normalize(lead.name))).size, arrivalDiscoveryLeads.length);
});

test('directory leads remain unverified and link to a source', () => {
  assert.ok(arrivalDiscoveryLeads.length > 0);
  for (const lead of arrivalDiscoveryLeads) {
    assert.equal(lead.status, 'unverified_lead');
    assert.ok(lead.name.trim());
    assert.ok(lead.address.trim());
    assert.ok(/^https?:\/\//.test(lead.sourceUrl), `Missing source URL for ${lead.name}`);
  }
});

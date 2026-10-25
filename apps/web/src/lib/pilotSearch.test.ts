import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPilotSearchParams } from './pilotSearch.ts';

describe('virtual pilot search query', () => {
  it('splits a city and Nigerian state for live inventory filtering', () => {
    const query = buildPilotSearchParams({
      destination: 'Uyo, Akwa Ibom',
      budgetNaira: '80000',
      rooms: '2',
    });
    assert.equal(query.get('kind'), 'STAY');
    assert.equal(query.get('city'), 'Uyo');
    assert.equal(query.get('state'), 'Akwa Ibom');
    assert.equal(query.get('q'), 'Uyo, Akwa Ibom');
    assert.equal(query.get('maxBaseTotalMinor'), '8000000');
    assert.equal(query.get('rooms'), '2');
  });

  it('supports city-only discovery without inventing a state', () => {
    const query = buildPilotSearchParams({ destination: 'Port Harcourt' });
    assert.equal(query.get('city'), 'Port Harcourt');
    assert.equal(query.has('state'), false);
    assert.equal(query.get('rooms'), '1');
  });

  it('preserves dates and ignores malformed or unsafe budgets', () => {
    const query = buildPilotSearchParams({
      destination: 'Lagos',
      checkIn: '2026-11-06',
      checkOut: '2026-11-08',
      budgetNaira: '1e9',
      rooms: '999',
    });
    assert.equal(query.get('startDate'), '2026-11-06');
    assert.equal(query.get('endDate'), '2026-11-08');
    assert.equal(query.has('maxBaseTotalMinor'), false);
    assert.equal(query.get('rooms'), '1');
  });

  it('does not turn a zero budget into a price filter', () => {
    const query = buildPilotSearchParams({ destination: 'Uyo', budgetNaira: '0' });
    assert.equal(query.has('maxBaseTotalMinor'), false);
  });
});

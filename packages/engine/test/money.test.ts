import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { earnPoints, formatMoney, majorToMinor, parseMinor, quotePrice } from '../src/money.ts';

describe('minor-unit boundaries', () => {
  it('accepts zero', () => assert.equal(parseMinor('0'), 0n));
  it('preserves all fifteen digits exactly', () => assert.equal(parseMinor('999999999999999'), 999999999999999n));
  for (const value of ['', '01', '-1', '+1', '1.0', '1e2', ' 1', '1\n', 'NaN', '1000000000000000']) {
    it(`rejects malformed or oversized minor input ${JSON.stringify(value)}`, () => assert.throws(() => parseMinor(value)));
  }
  it('rejects non-string money at runtime', () => assert.throws(() => parseMinor(1 as unknown as string)));
});

describe('exact NGN conversion and display', () => {
  for (const [major, minor] of [['0', '0'], ['0.01', '1'], ['12.3', '1230'], ['9999999999999.99', '999999999999999']]) {
    it(`converts ${major} naira exactly`, () => assert.equal(majorToMinor(major!), minor));
  }
  for (const value of ['.5', '1.', '1.001', '-0.01', '01.00', '1e2', '1\n', '10000000000000.00']) {
    it(`rejects invalid major input ${value}`, () => assert.throws(() => majorToMinor(value)));
  }
  it('formats zero with kobo', () => assert.equal(formatMoney('0'), '₦0.00'));
  it('formats a large balance without losing kobo', () => assert.equal(formatMoney('999999999999999'), '₦9,999,999,999,999.99'));
  it('labels an explicit currency', () => assert.equal(formatMoney('105', 'USD'), 'USD 1.05'));
  it('rejects an invalid currency label', () => assert.throws(() => formatMoney('100', '<script>')));
  it('rejects currency labels with trailing newlines', () => assert.throws(() => formatMoney('100', 'NGN\n')));
});

describe('quote pricing', () => {
  it('charges 10% of discounted service before tax', () => {
    assert.deepEqual(quotePrice({ unitPriceMinor: '125050', quantity: 2, units: 3, discountBps: 1250, taxBps: 750 }), {
      subtotalMinor: '750300', discountMinor: '93788', serviceMinor: '656512', taxMinor: '49238',
      totalMinor: '705750', commissionMinor: '65651', businessGrossMinor: '640099',
    });
  });
  it('rounds half a kobo upward for commission', () => assert.equal(quotePrice({ unitPriceMinor: '5', quantity: 1, units: 1 }).commissionMinor, '1'));
  it('rounds half a kobo upward for discounts', () => assert.equal(quotePrice({ unitPriceMinor: '1', quantity: 1, units: 1, discountBps: 5000 }).serviceMinor, '0'));
  it('rounds half a kobo upward for tax', () => assert.equal(quotePrice({ unitPriceMinor: '1', quantity: 1, units: 1, taxBps: 5000 }).totalMinor, '2'));
  it('supports a fully discounted service', () => assert.equal(quotePrice({ unitPriceMinor: '100', quantity: 1, units: 1, discountBps: 10000 }).totalMinor, '0'));
  it('supports zero-value service', () => assert.equal(quotePrice({ unitPriceMinor: '0', quantity: 1, units: 1 }).commissionMinor, '0'));
  it('supports an explicit zero commission', () => assert.equal(quotePrice({ unitPriceMinor: '100', quantity: 1, units: 1, commissionBps: 0 }).commissionMinor, '0'));
  for (const quantity of [0, -1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    it(`rejects invalid quantity ${quantity}`, () => assert.throws(() => quotePrice({ unitPriceMinor: '100', quantity, units: 1 })));
  }
  it('rejects zero duration', () => assert.throws(() => quotePrice({ unitPriceMinor: '100', quantity: 1, units: 0 })));
  for (const key of ['discountBps', 'taxBps', 'commissionBps'] as const) {
    it(`rejects out-of-range ${key}`, () => assert.throws(() => quotePrice({ unitPriceMinor: '100', quantity: 1, units: 1, [key]: 10001 })));
    it(`rejects fractional ${key}`, () => assert.throws(() => quotePrice({ unitPriceMinor: '100', quantity: 1, units: 1, [key]: 0.5 })));
  }
  it('rejects multiplied subtotal overflow', () => assert.throws(() => quotePrice({ unitPriceMinor: '999999999999999', quantity: 2, units: 1 })));
  it('rejects tax total overflow', () => assert.throws(() => quotePrice({ unitPriceMinor: '999999999999999', quantity: 1, units: 1, taxBps: 1 })));
});

describe('points rates', () => {
  it('earns whole points at the configured rate', () => assert.equal(earnPoints('1500', '1000', 3), 4));
  it('does not round fractional points upward', () => assert.equal(earnPoints('999', '1000', 1), 0));
  it('does not award points on zero service', () => assert.equal(earnPoints('0', '1000', 10), 0));
  it('supports a disabled earning rate', () => assert.equal(earnPoints('1000', '1000', 0), 0));
  it('rejects a zero spend denominator', () => assert.throws(() => earnPoints('1000', '0', 1)));
  for (const rate of [-1, 0.1, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    it(`rejects invalid rate ${rate}`, () => assert.throws(() => earnPoints('1000', '1000', rate)));
  }
  it('rejects unsafe point output rather than rounding it', () => assert.throws(() => earnPoints('999999999999999', '1', 100)));
});

export const MAX_MINOR = 999999999999999n;

export function parseMinor(value: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})$/.test(value)) {
    throw new RangeError('Money must be a nonnegative integer string of at most 15 digits.');
  }
  return BigInt(value);
}

export function majorToMinor(decimal: string): string {
  if (typeof decimal !== 'string' || !/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(decimal)) {
    throw new RangeError('NGN amounts require at most two decimal places.');
  }
  const [whole, fraction = ''] = decimal.split('.');
  return bounded(BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0')));
}

export function formatMoney(minor: string, currency = 'NGN'): string {
  const value = parseMinor(minor);
  if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError('Currency must be a three-letter uppercase code.');
  const whole = (value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency === 'NGN' ? '₦' : `${currency} `}${whole}.${(value % 100n).toString().padStart(2, '0')}`;
}

export interface QuoteInput {
  unitPriceMinor: string;
  quantity: number;
  units: number;
  discountBps?: number;
  taxBps?: number;
  commissionBps?: number;
}

export interface PriceQuote {
  subtotalMinor: string;
  discountMinor: string;
  serviceMinor: string;
  taxMinor: string;
  totalMinor: string;
  commissionMinor: string;
  businessGrossMinor: string;
}

function bounded(value: bigint): string {
  if (value < 0n || value > MAX_MINOR) throw new RangeError('Money exceeds the supported minor-unit range.');
  return value.toString();
}

function integer(value: number, label: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
}

function proportion(value: bigint, bps: number): bigint {
  integer(bps, 'Basis points', 0, 10000);
  return (value * BigInt(bps) + 5000n) / 10000n;
}

export function quotePrice(input: QuoteInput): PriceQuote {
  integer(input.quantity, 'Quantity', 1);
  integer(input.units, 'Units', 1);
  const subtotal = parseMinor(input.unitPriceMinor) * BigInt(input.quantity) * BigInt(input.units);
  bounded(subtotal);
  const discount = proportion(subtotal, input.discountBps ?? 0);
  const service = subtotal - discount;
  const tax = proportion(service, input.taxBps ?? 0);
  const commission = proportion(service, input.commissionBps ?? 1000);
  const total = service + tax;
  return {
    subtotalMinor: bounded(subtotal), discountMinor: bounded(discount), serviceMinor: bounded(service),
    taxMinor: bounded(tax), totalMinor: bounded(total), commissionMinor: bounded(commission),
    businessGrossMinor: bounded(total - commission),
  };
}

export function earnPoints(serviceMinor: string, spendMinor: string, points: number): number {
  const service = parseMinor(serviceMinor);
  const spend = parseMinor(spendMinor);
  integer(points, 'Points rate', 0);
  if (spend === 0n) throw new RangeError('The points spend denominator must be positive.');
  const result = service * BigInt(points) / spend;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Earned points exceed the safe integer range.');
  return Number(result);
}

export type DemandGoal = 'OCCUPANCY' | 'REVENUE' | 'BALANCED';
export interface DemandCounts {
  searches: number; quotes: number; confirmed: number; cancelled: number; fulfilled: number;
  capacity: number; allocated: number;
}
export interface DemandInput extends DemandCounts {
  asOf: string;
  periodStart?: string;
  goal: DemandGoal;
  /** Minimum recorded events, not a number of independent people or a statistical confidence. */
  minSamples?: number;
}
export type DemandAction = 'PROMOTE_AVAILABLE_CAPACITY' | 'REVIEW_RATE' | 'REVIEW_BOOKING_FLOW'
  | 'REVIEW_CANCELLATIONS' | 'KEEP_CURRENT_PLAN';
export interface DemandRecommendation {
  action: DemandAction; title: string; reason: string; requiresApproval: boolean;
}
export interface DemandEvidence extends DemandCounts {
  observations: number;
  occupancyBps: number | null;
  /** Confirmed/search event ratio. This does not claim a tracked customer conversion cohort. */
  conversionBps: number | null;
}
export interface DemandAssessment {
  status: 'READY' | 'INSUFFICIENT_DATA';
  goal: DemandGoal;
  asOf: string;
  period: { start: string | null; end: string };
  evidence: DemandEvidence;
  recommendations: DemandRecommendation[];
  reasons: string[];
  policyVersion: 'demand-rules-v1';
}

function observationTime(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
    throw new RangeError('Observation times must be ISO UTC timestamps.');
  }
  const timestamp = Date.parse(value);
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== normalized) {
    throw new RangeError('Observation times must be real dates and times.');
  }
  return timestamp;
}

export function assessDemand(input: DemandInput): DemandAssessment {
  const counts: DemandCounts = {
    searches: input.searches, quotes: input.quotes, confirmed: input.confirmed, cancelled: input.cancelled,
    fulfilled: input.fulfilled, capacity: input.capacity, allocated: input.allocated,
  };
  for (const [name, value] of Object.entries(counts)) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) {
      throw new RangeError(`${name} must be an integer between zero and one billion.`);
    }
  }
  if (counts.allocated > counts.capacity) throw new RangeError('Allocated capacity cannot exceed capacity.');
  if (!['OCCUPANCY', 'REVENUE', 'BALANCED'].includes(input.goal)) throw new RangeError('Unknown demand goal.');
  const minimum = input.minSamples ?? 20;
  if (!Number.isSafeInteger(minimum) || minimum < 1) throw new RangeError('Minimum events must be a positive safe integer.');
  const asOf = observationTime(input.asOf);
  const start = input.periodStart === undefined ? null : observationTime(input.periodStart);
  if (start !== null && start > asOf) throw new RangeError('The source period cannot start after the observation time.');
  const observations = counts.searches + counts.quotes + counts.confirmed + counts.cancelled + counts.fulfilled;
  const ratio = (numerator: number, denominator: number): number | null => denominator === 0
    ? null : Number(BigInt(numerator) * 10000n / BigInt(denominator));
  const evidence = { ...counts, observations, occupancyBps: ratio(counts.allocated, counts.capacity),
    conversionBps: ratio(counts.confirmed, counts.searches) };
  const reasons: string[] = [];
  if (observations < minimum) reasons.push(`Only ${observations} recorded events; at least ${minimum} are required.`);
  if (counts.capacity === 0) reasons.push('No saleable capacity was supplied.');
  const ready = reasons.length === 0;
  if (start === null) reasons.push('The source period start was not supplied.');
  return {
    status: ready ? 'READY' : 'INSUFFICIENT_DATA', goal: input.goal, asOf: input.asOf,
    period: { start: input.periodStart ?? null, end: input.asOf }, evidence,
    recommendations: ready ? [recommend(input.goal, evidence)] : [], reasons, policyVersion: 'demand-rules-v1',
  };
}

function recommend(goal: DemandGoal, evidence: DemandEvidence): DemandRecommendation {
  let action: DemandAction = 'KEEP_CURRENT_PLAN';
  let title = 'Keep the current plan';
  let reason = `${evidence.allocated} of ${evidence.capacity} capacity units are allocated; no rule calls for a change.`;
  if (evidence.cancelled >= 5 && evidence.cancelled * 4 >= evidence.confirmed + evidence.cancelled) {
    action = 'REVIEW_CANCELLATIONS'; title = 'Review recent cancellations';
    reason = `${evidence.cancelled} cancellations were recorded against ${evidence.confirmed} confirmations. Check the causes before changing offers.`;
  } else if (evidence.allocated === evidence.capacity) {
    reason = 'All supplied capacity is allocated. Do not promote unavailable inventory.';
  } else if ((goal === 'OCCUPANCY' && evidence.occupancyBps! < 8000)
    || (goal === 'BALANCED' && evidence.occupancyBps! < 6000)) {
    action = 'PROMOTE_AVAILABLE_CAPACITY'; title = 'Review an offer for available dates';
    reason = `${evidence.capacity - evidence.allocated} units remain available. The ${goal.toLowerCase()} goal favors filling existing capacity within approved price limits.`;
  } else if ((goal === 'REVENUE' && (evidence.occupancyBps! >= 7000 || (evidence.conversionBps ?? 0) >= 1500))
    || (goal === 'BALANCED' && evidence.occupancyBps! >= 8500 && (evidence.conversionBps ?? 0) >= 1500)) {
    action = 'REVIEW_RATE'; title = 'Review rates for the remaining capacity';
    reason = `${evidence.allocated} of ${evidence.capacity} units are allocated, with ${evidence.confirmed} confirmations and ${evidence.searches} searches. Review rates within business limits; no increase is assumed.`;
  } else if (goal === 'REVENUE') {
    action = 'REVIEW_BOOKING_FLOW'; title = 'Review the path from search to booking';
    reason = `${evidence.confirmed} confirmations and ${evidence.searches} searches were recorded. Check availability and booking friction before changing prices.`;
  }
  return { action, title, reason, requiresApproval: action !== 'KEEP_CURRENT_PLAN' };
}

import { z } from 'zod';
import { findNigeriaState } from './nigeriaLocations.ts';
export * from './nigeriaLocations.ts';

export const sectors = ['STAY', 'DINING', 'EXPERIENCE'] as const;
export type Sector = (typeof sectors)[number];
export type Role = 'CUSTOMER' | 'BUSINESS_OWNER' | 'RECEPTION' | 'ADMIN';
export type ReservationStatus =
  | 'HELD'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PAYMENT_REVIEW';
export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'UNKNOWN'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'REVIEW_REQUIRED';
export type SettlementStatus = 'UNSETTLED' | 'PENDING' | 'SETTLED' | 'FLAGGED' | 'UNKNOWN';
export type BusinessStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';
export type BenefitStatus = 'AVAILABLE' | 'LOCKED' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
export type TradeStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
export type PaymentProviderId = 'flutterwave' | 'paystack' | 'crypto';
export type PaymentMethod = 'FIAT' | 'USDC_BASE';
export type PaymentExecutionMode = 'mock' | PaymentProviderId;

const id = z.uuid();
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.');
export const minorUnits = z.string().regex(/^(0|[1-9]\d{0,14})$/, 'Use an exact amount in kobo.');
const positiveMinor = minorUnits.refine(
  (value) => value !== '0',
  'The price must be greater than zero.',
);
const email = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
const password = z.string().min(12, 'Use at least 12 characters.').max(128);
const shortText = z.string().trim().min(1).max(160);
export const nigeriaStateInput = z.string().trim().max(100).transform((value, context) => {
  if (!value) return null;
  const state = findNigeriaState(value);
  if (!state) {
    context.addIssue({ code: 'custom', message: 'Choose a Nigerian state or the FCT.' });
    return z.NEVER;
  }
  return state.name;
}).nullable().optional();

export const registerInput = z.strictObject({
  email,
  password,
  displayName: z.string().trim().min(2).max(100),
});
export const loginInput = z.strictObject({ email, password: z.string().min(1).max(128) });
export const profileInput = z.strictObject({
  displayName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional(),
});
export const businessApplicationInput = z.strictObject({
  businessName: shortText,
  city: shortText,
  state: nigeriaStateInput,
  address: z.string().trim().min(4).max(300),
  phone: z.string().trim().min(5).max(30),
  sector: z.enum(sectors),
  description: z.string().trim().min(20).max(2000),
});
export const offeringInput = z.strictObject({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(5000),
  kind: z.enum(sectors),
  venueId: id.optional(),
  city: shortText,
  state: nigeriaStateInput,
  address: z.string().trim().min(4).max(300),
  priceMinor: positiveMinor,
  capacity: z.int().min(1).max(10000),
  images: z
    .array(
      z.url().refine((url) => url.startsWith('https://') || url.startsWith('http://localhost:')),
    )
    .max(12)
    .default([]),
  amenities: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  cancellationHours: z.int().min(0).max(720).default(24),
  taxBps: z.int().min(0).max(5000).default(0),
  discountBps: z.int().min(0).max(9000).default(0),
  published: z.boolean().default(false),
});
export const availabilityInput = z.strictObject({
  startDate: localDate,
  endDate: localDate.optional(),
  startAt: z.iso.datetime({ offset: true }).optional(),
  endAt: z.iso.datetime({ offset: true }).optional(),
  capacity: z.int().min(0).max(10000),
  expectedRevision: z.int().min(0).optional(),
});
export const quoteInput = z.strictObject({
  offeringId: id,
  startDate: localDate,
  endDate: localDate.optional(),
  windowId: id.optional(),
  quantity: z.int().min(1).max(100),
});
export const reservationInput = z.strictObject({ quoteId: id });
export const reservationActionInput = z.strictObject({
  action: z.enum(['CHECK_IN', 'FULFILL', 'CANCEL']),
  expectedRevision: z.int().min(0),
  reason: z.string().trim().min(3).max(500).optional(),
});
export const walkInInput = z.strictObject({
  quoteId: id,
  customerEmail: email,
  customerName: z.string().trim().min(2).max(100),
});
export const checkoutInput = z
  .strictObject({
    method: z.enum(['FIAT', 'USDC_BASE']).default('FIAT'),
    payerAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.method === 'USDC_BASE' && !value.payerAddress)
      context.addIssue({
        code: 'custom',
        path: ['payerAddress'],
        message: 'Connect the wallet you will pay from.',
      });
  });
export const paymentVerifyInput = z.strictObject({
  reference: z.string().min(8).max(150),
  transactionId: z
    .string()
    .regex(/^(\d+|0x[a-fA-F0-9]{64})$/)
    .optional(),
  walletSignature: z
    .string()
    .regex(/^0x[a-fA-F0-9]{130}$/)
    .optional(),
});
export const rewardInput = z.strictObject({
  title: shortText,
  description: z.string().trim().min(10).max(2000),
  pointsCost: z.int().min(1).max(100000000),
  capacity: z.int().min(1).max(100000),
  expiresAt: z.iso.datetime({ offset: true }),
  transferable: z.boolean().default(false),
  published: z.boolean().default(false),
});
export const tradeInput = z.strictObject({
  benefitId: id,
  recipientEmail: email,
  requestedBenefitId: id.optional(),
});
export const tradeActionInput = z.strictObject({
  action: z.enum(['ACCEPT', 'DECLINE', 'CANCEL']),
  expectedRevision: z.int().min(0),
});
export const benefitConsumeInput = z.strictObject({
  code: z.string().min(8).max(80),
  expectedRevision: z.int().min(0),
});
export const staffInput = z.strictObject({
  email,
  displayName: z.string().trim().min(2).max(100),
  password,
  venueId: id.optional(),
});
export const businessVerificationEvidenceInput = z.strictObject({
  confirmed: z.boolean(),
  evidenceReference: z.string().trim().min(3).max(300),
});
export const businessVerificationInput = z.strictObject({
  propertyExists: businessVerificationEvidenceInput,
  partnerAuthority: businessVerificationEvidenceInput,
  directContact: businessVerificationEvidenceInput,
  fullAddress: businessVerificationEvidenceInput,
  coordinates: businessVerificationEvidenceInput,
  currentRates: businessVerificationEvidenceInput,
  roomInventoryAndPolicies: businessVerificationEvidenceInput,
  inventoryFreshnessHours: z.int().min(1).max(168),
});
export const businessStatusInput = z.strictObject({
  status: z.enum(['APPROVED', 'SUSPENDED']),
  reason: z.string().trim().min(3).max(500),
  verification: businessVerificationInput.optional(),
});
export const subaccountInput = z
  .strictObject({
    provider: z.enum(['flutterwave', 'paystack']).default('flutterwave'),
    subaccountCode: z
      .string()
      .regex(/^(RS_|ACCT_)[A-Za-z0-9_]+$/)
      .max(100),
    accountLabel: z.string().trim().min(3).max(100),
  })
  .superRefine((value, context) => {
    if (!value.subaccountCode.startsWith(value.provider === 'paystack' ? 'ACCT_' : 'RS_'))
      context.addIssue({
        code: 'custom',
        path: ['subaccountCode'],
        message: 'Use the code issued by the selected provider.',
      });
  });
export const cryptoWalletInput = z.strictObject({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  expectedRevision: z.int().min(0),
  expiresAt: z.iso.datetime({ offset: true }),
});
export const cryptoWalletApprovalInput = z.strictObject({
  expectedRevision: z.int().min(1),
  approved: z.boolean(),
  reason: z.string().trim().min(5).max(500),
});
export const cryptoRefundInput = z.strictObject({
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});
export const policyInput = z.strictObject({
  earnSpendMinor: positiveMinor,
  earnPoints: z.int().min(1).max(100000),
  holdMinutes: z.int().min(5).max(60),
  reason: z.string().trim().min(5).max(500),
});
export const receptionEventInput = z.strictObject({
  sourceId: id,
  events: z
    .array(
      z.strictObject({
        eventId: id,
        schemaVersion: z.literal(1),
        reservationId: id,
        expectedRevision: z.int().min(0),
        action: z.enum(['CHECK_IN', 'FULFILL', 'CANCEL']),
        occurredAt: z.iso.datetime({ offset: true }),
        reason: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export interface ApiErrorBody {
  error: { code: string; message: string; requestId?: string; fields?: Record<string, string[]> };
}
export interface ApiEnvelope<T> {
  data: T;
  pagination?: { page: number; pageSize: number; total: number };
}
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  businessId: string | null;
  venueIds: string[];
  phone?: string;
}
export interface SessionData {
  user: SessionUser | null;
  csrfToken: string | null;
  environment: string;
  paymentMode: PaymentExecutionMode | 'live';
}
export interface InventoryWindow {
  id: string;
  serviceDate: string;
  startAt: string;
  endAt: string;
  capacity: number;
  remaining: number;
  revision: number;
}
export interface HotelBookingOptimization {
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  roomsRequested: number;
  roomsAvailable: number;
  /** Base room subtotal only, before taxes, discounts, and provider fees. */
  estimatedBaseTotalMinor: string;
  matchScore: number;
  reasons: string[];
  checkedAt: string;
  policyVersion: '7even-hotel-ranking-v1';
}
export interface Offering {
  id: string;
  businessId: string;
  venueId: string;
  businessName: string;
  title: string;
  description: string;
  kind: Sector;
  city: string;
  state?: string | null;
  address: string;
  priceMinor: string;
  currency: 'NGN';
  unitLabel: string;
  capacity: number;
  images: string[];
  amenities: string[];
  cancellationHours: number;
  taxBps: number;
  discountBps: number;
  published: boolean;
  revision: number;
  windows: InventoryWindow[];
  isSample: boolean;
  /** Present for STAY listings returned by the booking optimizer. */
  bookingOptimization?: HotelBookingOptimization;
}
export interface PriceBreakdown {
  subtotalMinor: string;
  discountMinor: string;
  serviceMinor: string;
  taxMinor: string;
  totalMinor: string;
  commissionMinor: string;
  businessGrossMinor: string;
}
export interface Quote {
  id: string;
  offeringId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  windowIds: string[];
  quantity: number;
  units: number;
  price: PriceBreakdown;
  currency: 'NGN';
  expiresAt: string;
  policyVersion: number;
}
export interface Reservation {
  id: string;
  reference: string;
  offeringId: string;
  businessId: string;
  title: string;
  kind: Sector;
  city: string;
  image: string | null;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  startDate: string;
  endDate: string | null;
  startAt: string | null;
  quantity: number;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  settlementStatus: SettlementStatus;
  price: PriceBreakdown;
  holdExpiresAt: string | null;
  revision: number;
  createdAt: string;
  fulfilledAt: string | null;
  paymentId: string | null;
}
export interface CryptoQuote {
  reference: string;
  chainId: number;
  tokenAddress: string;
  decimals: 6;
  amountAtoms: string;
  payerAddress: string;
  recipientAddress: string;
  rateNgnPerUsdc: string;
  rateSource: string;
  rateFetchedAt: string;
  createdAt: string;
  expiresAt: string;
  anchorBlock: string;
  message: string;
}
export interface CryptoPayment {
  quote: CryptoQuote;
  transactionHash: string | null;
  payerVerified: boolean;
  evidence: Record<string, unknown>;
  refund: {
    id: string;
    amountAtoms: string;
    recipientAddress: string;
    transactionHash: string | null;
    status: string;
  } | null;
}
export interface Payment {
  id: string;
  reservationId: string;
  reference: string;
  providerTransactionId: string | null;
  status: PaymentStatus;
  settlementStatus: SettlementStatus;
  amountMinor: string;
  commissionMinor: string;
  feeMinor: string | null;
  merchantExpectedMinor: string;
  currency: 'NGN';
  createdAt: string;
  verifiedAt: string | null;
  mode: PaymentExecutionMode;
  provider: PaymentProviderId;
  method: PaymentMethod;
  routingPolicyVersion: string;
  settlementKind: 'BANK' | 'WALLET';
  commissionOwedMinor: string;
  crypto: CryptoPayment | null;
}
export interface Checkout {
  paymentId: string;
  reference: string;
  checkoutUrl: string;
  mode: PaymentExecutionMode;
  provider?: PaymentProviderId;
  method?: PaymentMethod;
}
export interface PaymentOptions {
  fiat: { provider: 'flutterwave' | 'paystack'; available: boolean; reason: string | null };
  crypto: {
    available: boolean;
    reason: string | null;
    asset: 'USDC';
    network: 'Base';
    chainId: number;
  };
  routingPolicyVersion: string;
  thresholdMinor: string;
  existingPaymentId: string | null;
  mode: 'mock' | 'live';
}
export interface BusinessPaymentAccount {
  id: string;
  provider: PaymentProviderId;
  accountCode: string;
  accountLabel: string;
  mode: PaymentExecutionMode;
  revision: number;
  status: string;
  verifiedAt: string | null;
  walletMessage?: string;
}
export interface PointEntry {
  id: string;
  amount: number;
  entryType: string;
  description: string;
  createdAt: string;
  sourceId: string;
}
export interface PointsAccount {
  balance: number;
  available: number;
  reserved: number;
  shortfall: number;
  entries: PointEntry[];
}
export interface Reward {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  pointsCost: number;
  remaining: number;
  capacity: number;
  expiresAt: string;
  transferable: boolean;
  published: boolean;
  revision: number;
}
export interface Benefit {
  id: string;
  rewardId: string;
  businessId: string;
  businessName: string;
  ownerId: string;
  title: string;
  description: string;
  status: BenefitStatus;
  expiresAt: string;
  transferable: boolean;
  redemptionCode: string;
  revision: number;
}
export interface Trade {
  id: string;
  benefitId: string;
  benefitTitle: string;
  requestedBenefitId: string | null;
  requestedBenefitTitle: string | null;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  status: TradeStatus;
  revision: number;
  expiresAt: string;
  createdAt: string;
}
export interface Business {
  id: string;
  businessName: string;
  city: string;
  state?: string | null;
  address: string;
  description: string;
  phone: string;
  sector: Sector;
  status: BusinessStatus;
  subaccountConfigured: boolean;
  accountLabel: string | null;
  createdAt: string;
  isSample: boolean;
  paymentAccounts?: BusinessPaymentAccount[];
  cryptoCommissionOwedMinor?: string;
}
export interface Activity {
  id: string;
  action: string;
  actorName: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  detail?: string;
}
export interface Notification {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  readAt: string | null;
}
export interface Metrics {
  totalReservations: number;
  confirmedReservations: number;
  arrivalsToday: number;
  fulfilledReservations: number;
  grossMinor: string;
  commissionMinor: string;
  availableCapacity: number;
  pointsIssued: number;
}
export interface DemandView {
  offeringId: string;
  title: string;
  assessment: {
    status: 'READY' | 'INSUFFICIENT_DATA';
    goal: string;
    asOf: string;
    period: { start: string | null; end: string };
    evidence: Record<string, number>;
    recommendations: { action: string; title: string; reason: string; requiresApproval: boolean }[];
    reasons: string[];
    policyVersion: string;
  };
}
export interface CustomerOverview {
  reservations: Reservation[];
  points: PointsAccount;
  benefits: Benefit[];
  trades: Trade[];
  notifications: Notification[];
  payments: Payment[];
}
export interface BusinessOverview {
  business: Business | null;
  offerings: Offering[];
  reservations: Reservation[];
  rewards: Reward[];
  metrics: Metrics;
  demand: DemandView[];
  activity: Activity[];
  staff: SessionUser[];
  notifications: Notification[];
  listingReadiness: ListingReadiness;
}
export interface ReceptionOverview {
  business: Business | null;
  offerings: Offering[];
  reservations: Reservation[];
  metrics: Metrics;
  activity: Activity[];
  sourceId: string;
  serverTime: string;
}
export interface AdminOverview {
  businesses: Business[];
  metrics: Metrics;
  reservations: Reservation[];
  payments: Payment[];
  activity: Activity[];
  policy: {
    version: number;
    earnSpendMinor: string;
    earnPoints: number;
    holdMinutes: number;
    commissionBps: number;
  };
  exceptions: { id: string; kind: string; message: string; createdAt: string }[];
  exceptionsSummary: {
    total: number;
    shown: number;
    truncated: boolean;
    perCategoryLimit: number;
  };
  listingReadiness: ListingReadiness;
}

export type ListingBlockerCode =
  | 'BUSINESS_NOT_APPROVED'
  | 'OFFERING_UNPUBLISHED'
  | 'HOTEL_VERIFICATION_REQUIRED'
  | 'NO_INVENTORY'
  | 'INVENTORY_EXPIRED'
  | 'INVENTORY_STALE'
  | 'INVENTORY_SOLD_OUT'
  | 'INVENTORY_CONFLICT'
  | 'INVENTORY_PROJECTION_LIMIT';
export type ListingWarningCode = 'STATE_MISSING' | 'STATE_UNRECOGNIZED';
export interface ListingCounts {
  offerings: number;
  published: number;
  eligible: number;
  blocked: number;
}
export interface OfferingListingReadiness {
  offeringId: string;
  title: string;
  kind: Sector;
  city: string;
  state: string | null;
  published: boolean;
  /** Visible without date, room-count, city, or state filters. Not a booking guarantee. */
  eligible: boolean;
  managedInventory: boolean;
  blockers: ListingBlockerCode[];
  warnings: ListingWarningCode[];
  inventory: {
    totalWindows: number;
    currentWindows: number;
    freshWindows: number;
    availableWindows: number;
  };
}
export interface BusinessListingReadiness {
  businessId: string;
  businessName: string;
  status: BusinessStatus;
  counts: ListingCounts;
  blockers: ('BUSINESS_NOT_APPROVED' | 'HOTEL_VERIFICATION_REQUIRED' | 'NO_OFFERINGS')[];
  offerings: OfferingListingReadiness[];
  offeringsLimit: number;
  offeringsTruncated: boolean;
}
export interface ListingReadiness {
  database: { status: 'connected'; checkedAt: string };
  totals: ListingCounts & { businesses: number };
  businesses: BusinessListingReadiness[];
  businessLimit: number;
  businessesTruncated: boolean;
}
export interface SyncResult {
  serverTime: string;
  outcomes: {
    eventId: string;
    status: 'APPLIED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED';
    message?: string;
    reservation?: Reservation;
  }[];
}

export const venueInput = z.strictObject({
  venueName: shortText,
  address: z.string().trim().min(4).max(300),
  city: shortText,
  timeZone: z.literal('Africa/Lagos').default('Africa/Lagos'),
});
export const paymentNoteInput = z.strictObject({
  amountMinor: positiveMinor,
  method: z.enum(['CASH', 'BANK_TRANSFER', 'EXTERNAL_POS']),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});
export const sourceStatusInput = z.strictObject({
  active: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});
export const rewardModerationInput = z.strictObject({
  published: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});
export interface Venue {
  id: string;
  businessId: string;
  venueName: string;
  address: string;
  city: string;
  timeZone: 'Africa/Lagos';
  revision: number;
}
export interface PaymentNote {
  id: string;
  reservationId: string;
  amountMinor: string;
  currency: 'NGN';
  method: 'CASH' | 'BANK_TRANSFER' | 'EXTERNAL_POS';
  reference: string;
  note: string;
  recordedBy: string;
  recordedAt: string;
}
export interface AdminOperations {
  health: {
    pendingInbox: number;
    failedInbox: number;
    pendingOutbox: number;
    failedOutbox: number;
    unknownPayments: number;
    pendingRefunds: number;
    syncConflicts: number;
    checkedAt: string;
  };
  sources: {
    id: string;
    businessId: string;
    businessName: string;
    userId: string;
    displayName: string;
    isActive: boolean;
    lastSyncedAt: string | null;
    eventCount: number;
  }[];
  rewards: Reward[];
}

export interface AdminRecordsPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

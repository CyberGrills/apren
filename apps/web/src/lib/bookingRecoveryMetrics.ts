export interface BookingRecoveryCounts {
  abandoned_sessions: number;
  consented_abandons: number;
  confirmed_after_abandon: number;
  unresolved_abandons: number;
}

export interface BookingRecoveryMetric {
  label: string;
  value: number;
  note: string;
}

/**
 * Present observed funnel outcomes without claiming causal or incremental uplift.
 * A booking confirmed after an abandonment is a verified temporal association,
 * not proof that a recovery intervention caused the booking.
 */
export function bookingRecoveryMetrics(counts: BookingRecoveryCounts): BookingRecoveryMetric[] {
  return [
    {
      label: 'Abandoned sessions',
      value: counts.abandoned_sessions,
      note: 'Observed booking intent',
    },
    {
      label: 'Consent recorded',
      value: counts.consented_abandons,
      note: 'Contact permission recorded',
    },
    {
      label: 'Bookings confirmed after abandonment',
      value: counts.confirmed_after_abandon,
      note: 'Verified outcome; not causal uplift',
    },
    {
      label: 'Unresolved sessions',
      value: counts.unresolved_abandons,
      note: 'No verified booking outcome linked',
    },
  ];
}

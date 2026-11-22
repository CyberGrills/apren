const identifier = (value: string): string => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value))
    throw new Error('Invalid SQL identifier for inventory freshness policy.');
  return value;
};

/**
 * Builds the shared SQL predicate used by search and inventory projections.
 * The database function owns the MANUAL/PMS thresholds so every path uses
 * exactly the same boundary semantics.
 */
export function inventoryFreshnessSql(
  windowAlias: string,
  businessAlias: string,
  allowLocalSample: boolean,
): string {
  const window = identifier(windowAlias);
  const business = identifier(businessAlias);
  const manualHours =
    `CASE WHEN ${business}.details #>> '{verificationReview,inventoryFreshnessHours}' ~ '^[0-9]{1,3}$' ` +
    `THEN (${business}.details #>> '{verificationReview,inventoryFreshnessHours}')::int ELSE 0 END`;
  const sample = allowLocalSample
    ? `${business}.details->>'isSample' = 'true'`
    : 'false';
  return `seven.inventory_window_is_fresh(${window}.inventory_source,${window}.inventory_confirmed_at,${manualHours},${sample})`;
}

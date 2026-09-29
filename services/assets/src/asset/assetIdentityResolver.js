const { pool } = require("../postgres");

async function resolveAssetIdentifier(identifier) {
  if (
    identifier === undefined ||
    identifier === null ||
    String(identifier).trim() === ""
  ) {
    throw new Error("Asset identifier is required.");
  }

  const raw = String(identifier).trim();

  const numericId =
    /^\d+$/.test(raw)
      ? Number(raw)
      : null;

  const result = await pool.query(
    `
    SELECT
      id,
      food_id,
      asset_code,
      current_value,
      freshness_score,
      demand_score,
      trust_score,
      market_status,
      total_trades,
      available_supply,
      kitchen_price
    FROM food_assets
    WHERE
      id = COALESCE($1::integer, -1)
      OR asset_code = $2
    ORDER BY
      CASE
        WHEN id = COALESCE($1::integer, -1) THEN 0
        ELSE 1
      END
    LIMIT 1
    `,
    [
      numericId,
      raw
    ]
  );

  if (!result.rows[0]) {
    throw new Error(
      `Asset not found: ${raw}`
    );
  }

  return result.rows[0];
}

module.exports = {
  resolveAssetIdentifier
};

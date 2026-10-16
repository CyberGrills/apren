const fs = require("node:fs");
const path = require("node:path");
const pool = require("../../shared/db");

function normalizeName(value) {
  return String(value || "")
    .toLocaleLowerCase("en-NG")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "../data", file), "utf8"));
}

function collectRecords() {
  const directory = readJson("uyo-hotel-directory.json");
  const curated = readJson("uyo-hotel-discovery-leads.json");
  const records = directory.records.map(record => ({
    name: record.name,
    normalizedName: normalizeName(record.name),
    address: record.address || null,
    phone: null,
    propertyTypeGuess: record.property_type_guess || "hotel_or_accommodation",
    sourceUrls: [...new Set([record.detail_url, ...(record.source_urls || []), record.source_url].filter(Boolean))],
    metadata: {
      source_name: record.source_name || directory.source,
      captured_at: record.captured_at || directory.captured_at,
      status: "unverified_lead",
      notes: record.notes || "Directory candidate; verification required."
    }
  }));

  for (const record of curated) {
    const normalizedName = normalizeName(record.name);
    records.push({
      name: record.name,
      normalizedName,
      address: record.address || null,
      phone: record.phone || null,
      propertyTypeGuess: /apartment|shortlet/i.test(record.name) ? "serviced_apartment_or_shortlet" : /guest house|guesthouse|motel|lodge/i.test(record.name) ? "guest_house_or_lodge" : "hotel_or_accommodation",
      sourceUrls: [record.source_url].filter(Boolean),
      metadata: {
        source_name: record.source_type || "public hotel directory",
        captured_at: new Date().toISOString(),
        status: "unverified_lead",
        notes: record.notes || "Directory candidate; verify before publication."
      }
    });
  }
  return records.filter(record => record.name && record.normalizedName);
}

async function main() {
  const records = collectRecords();
  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [70416002]);
    for (const record of records) {
      const result = await client.query(
        `INSERT INTO hospitality_discovery_leads
          (name, normalized_name, property_type_guess, address, phone, source_urls, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::text[], $7::jsonb)
         ON CONFLICT (normalized_name) DO UPDATE SET
           source_urls = ARRAY(SELECT DISTINCT unnest(hospitality_discovery_leads.source_urls || EXCLUDED.source_urls)),
           address = COALESCE(NULLIF(hospitality_discovery_leads.address, ''), EXCLUDED.address),
           phone = COALESCE(NULLIF(hospitality_discovery_leads.phone, ''), EXCLUDED.phone),
           property_type_guess = COALESCE(NULLIF(hospitality_discovery_leads.property_type_guess, ''), EXCLUDED.property_type_guess),
           metadata = hospitality_discovery_leads.metadata || EXCLUDED.metadata,
           last_seen_at = NOW(), updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
        [record.name, record.normalizedName, record.propertyTypeGuess, record.address, record.phone, record.sourceUrls, JSON.stringify(record.metadata)]
      );
      if (result.rows[0].inserted) inserted += 1;
      else updated += 1;
    }
    await client.query("COMMIT");
    const count = await client.query("SELECT status, COUNT(*)::int AS count FROM hospitality_discovery_leads GROUP BY status ORDER BY status");
    console.log(JSON.stringify({ processed: records.length, inserted, updated, statuses: count.rows, public_inventory_changed: false }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error("Uyo lead import failed:", error.message);
  process.exitCode = 1;
});

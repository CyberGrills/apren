const fs = require("node:fs");
const path = require("node:path");
const pool = require("../../shared/db");

async function main() {
  const migrationFiles = ["001_hospitality.sql", "002_arrival_and_lifecycle.sql", "003_verified_location_contact.sql", "004_paystack_refunds.sql", "005_discovery_leads.sql"];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialize migration execution across service instances.
    await client.query("SELECT pg_advisory_xact_lock($1)", [70416001]);

    const usersTable = await client.query("SELECT to_regclass('public.users') AS name");
    if (!usersTable.rows[0].name) {
      throw new Error(
        "Required public.users table is missing. Apply and verify the identity schema first."
      );
    }

    for (const filename of migrationFiles) {
      const sqlPath = path.join(__dirname, "../migrations", filename);
      const sql = fs.readFileSync(sqlPath, "utf8");
      await client.query(sql);
      console.log("Hospitality migration " + filename + " applied successfully.");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error("Hospitality migration failed:", error.message);
  process.exitCode = 1;
});

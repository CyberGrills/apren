const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || "apren",
  user: process.env.PGUSER || "apren",
  password: process.env.PGPASSWORD || "apren",
});

pool.on("error", (err) => {
  console.error("āprən database error:", err.message);
});

module.exports = pool;

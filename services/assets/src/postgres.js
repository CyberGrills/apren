const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || "apren",
  user: process.env.POSTGRES_USER || "apren",
  password: process.env.POSTGRES_PASSWORD || "apren"
});


pool.on("error", (err)=>{
  console.error("Assets PostgreSQL error:", err.message);
});


async function query(text, params=[]){

  const client = await pool.connect();

  try {

    const result = await client.query(
      text,
      params
    );

    return result.rows;

  } finally {

    client.release();

  }

}


module.exports = {
  query,
  pool
};

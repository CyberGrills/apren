#!/bin/bash
set -e

cd ~/apren

echo "=== āprən PostgreSQL bridge setup ==="

mkdir -p services/shared

if [ -f services/shared/db.js ]; then
  cp services/shared/db.js services/shared/db.js.backup.$(date +%s)
fi

cat > services/shared/db.js <<'EOF'
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
EOF

echo
echo "=== installing pg driver ==="

for service in wallet trade intelligence assets; do
  if [ -f "services/$service/package.json" ]; then
    echo "Installing pg in $service"
    cd services/$service
    npm install pg --save
    cd ~/apren
  fi
done

echo
echo "=== database connection test ==="

node <<'EOF'
const pool=require("./services/shared/db");

(async()=>{
 try{
   const result=await pool.query(
     "SELECT current_user,current_database()"
   );

   console.log(result.rows[0]);

   await pool.end();
 }catch(err){
   console.error(err.message);
   process.exit(1);
 }
})();
EOF

echo
echo "=== āprən PostgreSQL bridge ready ==="

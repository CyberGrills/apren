#!/bin/bash
set -e

cd ~/apren

echo "=== āprən Wallet PostgreSQL migration ==="

cp services/wallet/src/server.js \
services/wallet/src/server.js.backup.$(date +%s)

cat > services/wallet/src/server.js <<'EOF'
const express = require("express");
const cors = require("cors");

const pool = require("../../shared/db");

const app = express();

app.use(cors());
app.use(express.json());


app.get("/wallet/:userId", async (req,res)=>{

  try {

    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        balance,
        currency,
        currency_code,
        wallet_type,
        locked_balance,
        status
      FROM wallets
      WHERE user_id=$1
      `,
      [req.params.userId]
    );


    res.json({
      system:"apren-wallet",
      wallets:result.rows
    });


  } catch(error){

    console.error(error);

    res.status(500).json({
      system:"apren-wallet",
      error:"Database wallet lookup failed"
    });

  }

});


app.listen(4002,()=>{
 console.log("āprən Wallet Service running on 4002");
});
EOF


echo
echo "=== testing wallet database ==="

node <<'EOF'
const pool=require("./services/shared/db");

(async()=>{
 try{
   const r=await pool.query(
     "SELECT COUNT(*) FROM wallets"
   );

   console.log("wallet rows:",r.rows[0].count);

   await pool.end();

 }catch(e){
   console.error(e.message);
   process.exit(1);
 }
})();
EOF


echo
echo "=== wallet migration complete ==="

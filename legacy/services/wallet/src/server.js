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


if (process.env.VERCEL !== "1") {
  app.listen(4002, () => {
    console.log("āprən Wallet Service running on 4002");
  });
}

module.exports = app;

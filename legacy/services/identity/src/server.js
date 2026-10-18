const express = require("express");
const cors = require("cors");

const pool = require("../../shared/db");

const app = express();

app.use(cors());
app.use(express.json());


app.get("/users", async(req,res)=>{

 try {

  const result = await pool.query(`
    SELECT
      id,
      name,
      email,
      role
    FROM users
    ORDER BY id
  `);

  res.json({
    system:"apren-identity",
    users:result.rows
  });


 } catch(error){

  res.status(500).json({
    error:"User lookup failed"
  });

 }

});



app.get("/users/:id", async(req,res)=>{

 try {

  const result = await pool.query(
   `
   SELECT
    id,
    name,
    email,
    role
   FROM users
   WHERE id=$1
   `,
   [req.params.id]
  );


  if(result.rows.length===0){

    return res.status(404).json({
      error:"User not found"
    });

  }


  res.json(result.rows[0]);


 } catch(error){

  res.status(500).json({
    error:"User lookup failed"
  });

 }

});



app.get("/users/:id/preferences", async(req,res)=>{

 try {


  const user = await pool.query(
   `
   SELECT id
   FROM users
   WHERE id=$1
   `,
   [req.params.id]
  );


  if(user.rows.length===0){

    return res.status(404).json({
      error:"User not found"
    });

  }


  const currency = await pool.query(
   `
   SELECT preferred_currency
   FROM user_currency_preferences
   WHERE user_id=$1
   LIMIT 1
   `,
   [req.params.id]
  );


  const preferred =
    currency.rows[0]?.preferred_currency || "EUR";


  res.json({

    userId:Number(req.params.id),

    preferences:{

      preferred_currency:preferred,

      display_currency:preferred,

      food_currency:"ə"

    }

  });


 } catch(error){

  res.status(500).json({
    error:"Preference lookup failed"
  });

 }

});



if (process.env.VERCEL !== "1") {
  app.listen(4001, () => {
    console.log("āprən Identity Service running on 4001");
  });
}

module.exports = app;

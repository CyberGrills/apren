const express = require("express");
const cors = require("cors");
const axios = require("axios");

const {
calculateFreshness
}=require("./freshness/engine");

const {
saveEvidence,
getEvidence
}=require("./freshness/storage");

const app = express();

app.use(cors());
app.use(express.json());


function calculateBrain(asset){

    const freshnessScore =
        asset.freshness_score ??
        (
          typeof asset.freshness === 'object'
          ? asset.freshness.score
          : asset.freshness
        ) ??
        0;

    let demandScore = 50;

    if(asset.demand === "High"){
        demandScore = 90;
    }

    if(asset.demand === "Increasing"){
        demandScore = 75;
    }

    if(asset.demand === "Steady"){
        demandScore = 60;
    }


    const trustScore = 50;
    const liquidityScore = 40;


    const brainScore = Math.round(
        freshnessScore * 0.35 +
        demandScore * 0.30 +
        trustScore * 0.20 +
        liquidityScore * 0.15
    );


    let state="STABLE_ASSET";
    let recommendation="WATCH";


    if(brainScore >= 75){
        state="GROWING_ASSET";
        recommendation="HOLD";
    }


    if(brainScore >= 90){
        state="HIGH_VALUE_ASSET";
        recommendation="ACCUMULATE";
    }


    return {
        assetId: asset.id,
        asset: asset.name,
        value: asset.base_value,
        currency: asset.currency,

        brainScore,

        state,
        recommendation,

        metrics:{
            freshness:freshnessScore,
            demand:demandScore,
            trust:trustScore,
            liquidity:liquidityScore
        }
    };

}



app.get("/brain/asset/:id", async(req,res)=>{

    try{

        const response = await axios.get(
            `http://localhost:4003/assets/${req.params.id}`
        );


        const result = calculateBrain(response.data);


        res.json({
            system:"apren-food-intelligence-engine",
            result
        });


    }catch(error){

        res.status(500).json({
            error:"Unable to analyze asset",
            details:error.message
        });

    }

});





app.post("/evidence/upload",(req,res)=>{

const evidence =
saveEvidence(req.body);

res.json({
system:"apren-evidence-engine",
evidence
});

});


app.get("/freshness/:assetId",(req,res)=>{

res.json({

system:"apren-freshness-engine",

evidence:
getEvidence(req.params.assetId)

});

});


if (process.env.VERCEL !== "1") {
  app.listen(4005, () => {
    console.log("āprən Intelligence Engine running on 4005");
  });
}

module.exports = app;

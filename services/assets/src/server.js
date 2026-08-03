const supplyIntelligenceEngine = require("./market/supplyIntelligenceEngine");
const demandForecastEngine = require("./market/demandForecastEngine");
const marketIntelligenceEngine = require("./market/marketIntelligenceEngine");

const valuationEngine = require("./economy/valuationEngine");
const marketPulseEngine = require("./economy/marketPulseEngine");
const economicEventEngine = require("./economy/economicEventEngine");

const executiveGovernor = require("./governor/executiveGovernor");

const agentCouncilEngine = require("./agents/agentCouncilEngine");

const optimizationEngine = require("./optimization/optimizationEngine");
const ruleEvolutionEngine = require("./optimization/ruleEvolutionEngine");

const actionEngine = require("./autonomy/actionEngine");
const automationEngine = require("./autonomy/automationEngine");

const feedbackEngine = require("./learning/feedbackEngine");
const accuracyEngine = require("./learning/accuracyEngine");
const adaptationEngine = require("./learning/adaptationEngine");

const brainMemoryEngine = require("./memory/brainMemoryEngine");
const predictionEngine = require("./memory/predictionEngine");

const foodBrainOrchestrator = require("./orchestrator/foodBrainOrchestrator");

const foodBrainEngine = require("./brain/foodBrainEngine");

const decisionEngine = require("./intelligence/decisionEngine");

const lifecycleEngine = require("./lifecycle/lifecycleEngine");

const ruleEngine = require("./rules/ruleEngine");

const passportEngine = require("./passport/passportEngine");

const foodEvidenceEngine = require("./intelligence/foodEvidenceEngine");

const portfolioEngine = require("./economy/portfolioEngine");
const fundingEngine = require("./economy/fundingEngine");
const tradePreview = require("./economy/tradePreview");

const tradeEngine = require("./transactions/tradeEngine");

const foodTransactionEngine = require("./transactions/foodTransactionEngine");

const assetCreationService = require("./services/assetCreationService");

const express = require("express");
const cors = require("cors");
const createAssetProfile = require("./identity/profile");

const db = require("./db");
const analyzeFreshness = require("./intelligence/freshness");
const detectFood = require("./intelligence/food-vision");
const calculateDecayIntelligence = require("./intelligence/freshness-decay");
const adjustValue = require("./intelligence/value-adjustment");
const calculateMarketValue = require("./market/price-engine");
const calculateDecay = require("./intelligence/decay");
const analyzeEvidence = require("./intelligence/evidence-analysis");
const lifecycle = require("./lifecycle/lifecycle");
const verificationEngine = require("./verification/verify");
const evidence = require("./evidence/evidence");
const passportDB = require("./passport/passport-db");
const ownershipDB = require("./ownership/ownership-db");


const app = express();


db.exec(`

CREATE TABLE IF NOT EXISTS asset_evidence (

id INTEGER PRIMARY KEY AUTOINCREMENT,

asset_id INTEGER NOT NULL,

type TEXT,

file TEXT,

uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,

analysis_status TEXT DEFAULT 'PENDING',

freshness_score REAL,

confidence REAL

);

`);



app.use(cors());
app.use(express.json());

db.exec(`

CREATE TABLE IF NOT EXISTS asset_events (

id INTEGER PRIMARY KEY AUTOINCREMENT,

asset_id INTEGER NOT NULL,

event_type TEXT NOT NULL,

event_source TEXT,

description TEXT,

metadata TEXT,

created_at TEXT DEFAULT CURRENT_TIMESTAMP

);

`);



function createAssetEvent(
assetId,
type,
source,
description,
metadata={}
){

db.prepare(`

INSERT INTO asset_events

(
asset_id,
event_type,
event_source,
description,
metadata
)

VALUES
(?,?,?,?,?)

`).run(

assetId,

type,

source,

description,

JSON.stringify(metadata)

);

}



function buildFreshnessProfile(asset, analysis={}){

return {

score:
analysis.score ??
asset.freshness_score ??
0,

confidence:
analysis.confidence ??
analysis.confidenceScore ??
0,

expiry:
analysis.expiry ??
analysis.estimatedExpiry ??
asset.expiry_time ??
null,

lifecycle:
analysis.lifecycle ??
(asset.expiry_time ? "ACTIVE" : "FRESH")

};

}






app.get("/assets",(req,res)=>{


const assets = db
.prepare(
"SELECT * FROM food_assets"
)
.all();


res.json({

system:"apren-food-asset-engine",

assets

});


});




app.get("/assets/:id",(req,res)=>{


const asset = db
.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(req.params.id);



if(!asset){

return res.status(404).json({

error:"Asset not found"

});

}



const freshness = analyzeFreshness({

category:asset.category,

imageConfidence:asset.freshness_score

});



res.json({

...asset,

freshness_score:
freshness.score,

freshness:

buildFreshnessProfile(

asset,

freshness

)

});


});




app.get("/assets/user/:userId",(req,res)=>{


const assets = db
.prepare(
"SELECT * FROM food_assets WHERE owner_id=?"
)
.all(req.params.userId);



res.json({

owner:req.params.userId,

assets

});


});






app.post("/assets", async(req,res)=>{

try {

const asset =
await assetCreationService.createFoodAsset(
req.body
);


res.json({

created:true,

asset

});


}
catch(error){

console.error(error);

res.status(500).json({

error:error.message

});

}





});








app.get("/passport/:assetId",(req,res)=>{


const asset = db.prepare(

"SELECT * FROM food_assets WHERE id=?"

).get(req.params.assetId);



if(!asset){

return res.status(404).json({

error:"Asset not found"

});

}



const history = db.prepare(

"SELECT * FROM passport_events WHERE asset_id=? ORDER BY id ASC"

).all(req.params.assetId);



res.json({

system:"apren-food-passport",

passport:{

assetId:asset.id,

food:asset.name,

origin:asset.kitchen,

category:asset.category,

owner:asset.owner_id,

value:asset.base_value,

currency:asset.currency,

freshness:asset.freshness_score,

demand:asset.demand,

status:asset.status,

history

}

});


});





app.get("/ownership/:assetId",(req,res)=>{


const holding = db.prepare(`

SELECT

h.asset_id,
h.owner_id,
h.quantity,
h.ownership_type,
h.acquired_at,
a.name AS asset

FROM food_asset_holdings h

JOIN food_assets a

ON a.id=h.asset_id

WHERE h.asset_id=?

`).get(req.params.assetId);



if(!holding){

return res.status(404).json({

error:"Ownership record not found"

});

}



res.json({

system:"apren-food-ownership",

ownership:{

asset:holding.asset,

assetId:holding.asset_id,

owner:holding.owner_id,

quantity:holding.quantity,

status:"owned",

ownershipType:holding.ownership_type,

acquiredAt:holding.acquired_at

}

});


});






app.post("/lifecycle/:id/event",(req,res)=>{

 const event=lifecycle.createEvent(
    req.params.id,
    req.body.type,
    req.body.description
 );

 res.json({
    system:"apren-food-lifecycle",
    event
 });

});


app.get("/lifecycle/:id",(req,res)=>{

 res.json({
    system:"apren-food-lifecycle",
    assetId:req.params.id,
    events:lifecycle.getEvents(req.params.id)
 });

});




app.post("/verify/:id",(req,res)=>{


 const result = verification.verifyFood({

    id:req.params.id,

    type:req.body.type,

    file:req.body.file

 });


 lifecycle.createEvent(
    req.params.id,
    "VERIFIED",
    "Food evidence verified by āprən intelligence"
 );


 res.json({

    system:"apren-food-verification",

    verification:result

 });


});



app.get("/verify/:id",(req,res)=>{


 res.json({

    system:"apren-food-verification",

    assetId:req.params.id,

    records:
       verification.getVerification(req.params.id)

 });


});







app.get("/freshness/:id",(req,res)=>{


 const result = calculateDecay({

    id:Number(req.params.id),

    name:"Chicken Rice Bowl",

    category:"Prepared meals",

    verifiedAt:new Date()

 });


 res.json({

    system:"apren-freshness-engine",

    assetId:req.params.id,

    result

 });


});





app.get("/asset-profile/:id",(req,res)=>{

 const id=req.params.id;

 try {

   const asset = db.prepare(
     "SELECT * FROM food_assets WHERE id=?"
   ).get(id);


   if(!asset){
      return res.status(404).json({
        error:"Asset not found",
        assetId:id
      });
   }


   const freshness = analyzeFreshness({
      category: asset.category,
      imageConfidence: asset.freshness_score
   });


   const passport = db.prepare(
      "SELECT * FROM passport_events WHERE asset_id=? ORDER BY created_at ASC"
   ).all(id);


   const ownership = db.prepare(
      "SELECT * FROM food_asset_holdings WHERE asset_id=?"
   ).get(id)
   || {
        asset_id:id,
        owner_id:null
      };


   const lifecycleEvents =
      lifecycle.getEvents(id);


   const verificationResult =
      verificationEngine.verifyFood(asset);


   res.json({

      system:"apren-food-asset-profile",

      asset,

      intelligence:{
        freshness
      },

      passport,

      ownership,

      lifecycle:lifecycleEvents,

      verification: verificationResult

   });


 } catch(error){

    res.status(500).json({
      error:error.message
    });

 }

});





app.post("/assets/:id/evidence",(req,res)=>{

try{

const result=evidence.addEvidence(
req.params.id,
req.body.type || "image",
req.body.file || "unknown"
);

res.json({

system:"apren-food-evidence",

evidence:result

});


}catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/assets/:id/evidence",(req,res)=>{

const records=db.prepare(
"SELECT * FROM food_evidence WHERE asset_id=?"
)
.all(req.params.id);


res.json({

assetId:req.params.id,

evidence:records

});

});




app.post("/assets/:id/evidence/:evidenceId/analyze",(req,res)=>{

try{


const evidence =
db.prepare(
"SELECT * FROM food_evidence WHERE id=?"
)
.get(req.params.evidenceId);



if(!evidence){

return res.status(404).json({
error:"Evidence not found"
});

}



const analysis =
analyzeEvidence(evidence);



db.prepare(`
UPDATE food_evidence

SET
analysis_status=?,
freshness_score=?,
confidence=?

WHERE id=?

`)
.run(
analysis.status,
analysis.freshnessScore,
analysis.confidence,
req.params.evidenceId
);



db.prepare(`
UPDATE food_assets

SET
freshness_score=?,
expiry_time=?

WHERE id=?

`)
.run(
analysis.freshnessScore,
analysis.estimatedExpiry,
req.params.id
);



res.json({

system:"apren-evidence-intelligence",

assetId:req.params.id,

evidenceId:req.params.evidenceId,

analysis

});


}catch(error){

res.status(500).json({
error:error.message
});

}


});




app.post("/assets/:id/analyze-food",(req,res)=>{

try{


const asset =
db.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(req.params.id);



if(!asset){

return res.status(404).json({
error:"Asset not found"
});

}



const vision =
detectFood(asset);



const decay =
calculateDecayIntelligence(asset);



const valuation =
adjustValue(asset,decay);



db.prepare(`
UPDATE food_assets

SET freshness_score=?

WHERE id=?

`)
.run(
decay.freshnessScore,
req.params.id
);



res.json({

system:"apren-food-intelligence",

asset,

vision,

freshness:decay,

valuation

});


}catch(error){

res.status(500).json({
error:error.message
});

}


});






app.get("/assets/:id/market-value",(req,res)=>{

try {

const asset=db
.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(req.params.id);


if(!asset){

return res.status(404).json({
error:"Asset not found"
});

}


const freshness =
analyzeFreshness({

category:asset.category,

imageConfidence:
asset.freshness_score

});


const marketValue =
Number(
(
asset.base_value *
(freshness.score / 100)
).toFixed(2)
);



res.json({

system:"apren-food-market-engine",

asset:asset.name,

market:{

baseValue:asset.base_value,

marketValue,

currency:asset.currency,

signals:{

demand:asset.demand,

availability:asset.status

}

}

});


}catch(error){

res.status(500).json({

error:error.message

});

}

});




app.get("/assets/:id/market-intelligence",(req,res)=>{

try{

const asset =
db.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(req.params.id);


if(!asset){

return res.status(404).json({
error:"Asset not found"
});

}


const signals =
db.prepare(
"SELECT * FROM market_signals WHERE asset_id=?"
)
.get(asset.id);


const value =
(
asset.base_value *
signals.demand_multiplier *
signals.freshness_multiplier *
signals.scarcity_multiplier *
signals.location_multiplier *
signals.seasonal_multiplier
).toFixed(2);


res.json({

system:"apren-market-intelligence",

asset:asset.name,

valuation:{

baseValue:asset.base_value,

marketValue:Number(value),

currency:asset.currency

},

signals

});


}catch(error){

res.status(500).json({
error:error.message
});

}

});




app.post("/evidence/analyze/:id",(req,res)=>{


const asset =
db.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(req.params.id);



if(!asset){

return res.status(404).json({
error:"Asset not found"
});

}



const evidenceResult =
analyzeEvidence({

assetId:asset.id,

category:asset.category,

mediaType:req.body.media_type || "photo",

source:req.body.source || "camera"

});



const freshness =
analyzeFreshness({

category:asset.category,

imageConfidence:
evidenceResult.confidence || asset.freshness_score

});



const expiry =
calculateDecayIntelligence({

category:asset.category,

verifiedAt:new Date()

});



// Persist evidence record



createAssetEvent(

asset.id,

"EVIDENCE_ANALYZED",

"EVIDENCE_ENGINE",

"Food evidence analyzed and freshness intelligence updated",

{

mediaType:req.body.media_type || "photo",

freshness:evidenceResult.freshnessScore || freshness.score,

confidence:evidenceResult.confidence || freshness.confidence

}

);


db.prepare(`

INSERT INTO asset_evidence

(

asset_id,

type,

file,

analysis_status,

freshness_score,

confidence

)

VALUES

(?,?,?,?,?,?)

`).run(

asset.id,

req.body.media_type || "photo",

req.body.source || "camera_upload",

"ANALYZED",

evidenceResult.freshnessScore ||
freshness.score,

evidenceResult.confidence ||
freshness.confidence

);




db.prepare(`

UPDATE food_assets

SET

freshness_score=?,

expiry_time=?

WHERE id=?

`).run(

freshness.score || asset.freshness_score,

expiry.expiry_time || freshness.estimatedExpiry || null,

asset.id

);




db.prepare(`

INSERT INTO passport_events

(

asset_id,

event_type,

description

)

VALUES

(?,?,?)

`).run(

asset.id,

"FRESHNESS_UPDATED",

"Freshness updated from food evidence intelligence"

);




res.json({

system:"apren-food-intelligence-engine",

assetId:asset.id,

freshness:

buildFreshnessProfile(

asset,

{

score:freshness.score,

confidence:freshness.confidence,

expiry:expiry.expiry_time || freshness.estimatedExpiry,

lifecycle:expiry.lifecycle

}

),

evidence:evidenceResult

});


});





app.get("/passport/intelligence/:assetId",(req,res)=>{


const id=req.params.assetId;


const asset =
db.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(id);



if(!asset){

return res.status(404).json({

error:"Asset not found"

});

}



const evidence =
db.prepare(`

SELECT

*

FROM asset_evidence

WHERE asset_id=?

ORDER BY id DESC

`)
.all(id);



const history =
db.prepare(`

SELECT

*

FROM passport_events

WHERE asset_id=?

ORDER BY id ASC

`)
.all(id);



const freshness =
buildFreshnessProfile(

asset,

{

score:asset.freshness_score,

confidence:asset.freshness_score,

expiry:asset.expiry_time,

lifecycle:
asset.expiry_time
?
"ACTIVE"
:
"FRESH"

}

);



res.json({

system:"apren-food-passport-intelligence",


asset:{

id:asset.id,

name:asset.name,

category:asset.category,

origin:asset.kitchen,

owner:asset.owner_id

},


freshness,


evidence:{

verified:evidence.length>0,

records:evidence.length,

latest:evidence[0] || null

},


market:{

value:asset.base_value,

currency:asset.currency,

demand:asset.demand

},


ownership:{

owner:asset.owner_id,

status:"owned"

},


history


});


});





app.get("/assets/:id/intelligence",(req,res)=>{


const asset =
db.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(req.params.id);



if(!asset){

return res.status(404).json({

error:"Asset not found"

});

}



const evidence =
db.prepare(`

SELECT *

FROM asset_evidence

WHERE asset_id=?

ORDER BY id DESC

`)
.get(req.params.id);



const history =
db.prepare(`

SELECT *

FROM passport_events

WHERE asset_id=?

ORDER BY id ASC

`)
.all(req.params.id);



const ownership =
db.prepare(`

SELECT *

FROM food_asset_holdings

WHERE asset_id=?

`)
.get(req.params.id)
||
{
owner_id:asset.owner_id,
quantity:1
};



const freshness =
buildFreshnessProfile(

asset,

{

score:asset.freshness_score,

confidence:evidence?.confidence || 0,

expiry:asset.expiry_time,

lifecycle:
asset.expiry_time
?
"ACTIVE"
:
"FRESH"

}

);



const demandScore =
asset.demand==="High"
?
90
:
asset.demand==="Increasing"
?
75
:
60;



const brainScore=Math.round(

freshness.score * 0.35 +

demandScore * 0.30 +

50 * 0.20 +

40 * 0.15

);



let state="STABLE_ASSET";

let recommendation="WATCH";


if(brainScore>=75){

state="GROWING_ASSET";

recommendation="HOLD";

}


if(brainScore>=90){

state="HIGH_VALUE_ASSET";

recommendation="ACCUMULATE";

}



res.json({

system:"apren-food-passport-live-intelligence",

asset:{

id:asset.id,

name:asset.name,

category:asset.category,

origin:asset.kitchen,

owner:asset.owner_id

},


passport:{

verified:
!!evidence,

evidenceCount:
evidence ? 1 : 0,

history

},


freshness,


market:{

value:asset.base_value,

currency:asset.currency,

demand:asset.demand

},


ownership:{


owner:
ownership.owner_id,

quantity:
ownership.quantity || 1,

status:"owned"

},


brain:{

score:brainScore,

state,

recommendation

}

});


});





app.get("/assets/:id/valuation",(req,res)=>{


const asset =
db.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(req.params.id);



if(!asset){

return res.status(404).json({

error:"Asset not found"

});

}



const evidence =
db.prepare(`

SELECT COUNT(*) count

FROM asset_evidence

WHERE asset_id=?

`)
.get(req.params.id);



const freshness =
asset.freshness_score || 0;



let demandScore=50;


if(asset.demand==="High"){

demandScore=90;

}

else if(asset.demand==="Increasing"){

demandScore=75;

}

else if(asset.demand==="Steady"){

demandScore=60;

}



const trustScore = Math.min(

100,

50 + (evidence.count * 25)

);



const ownership =
db.prepare(`

SELECT COUNT(*) count

FROM food_asset_holdings

WHERE asset_id=?

`)
.get(req.params.id);



const liquidityScore =
Math.min(

100,

40 + (ownership.count * 15)

);



const freshnessMultiplier =
freshness / 100;



const demandMultiplier =
1 + ((demandScore-50)/500);



const trustMultiplier =
1 + ((trustScore-50)/1000);



const liquidityMultiplier =
1 + ((liquidityScore-40)/1000);



const currentValue = Number(

(

asset.base_value *

freshnessMultiplier *

demandMultiplier *

trustMultiplier *

liquidityMultiplier

).toFixed(2)

);



const brainScore=Math.round(

freshness * 0.35 +

demandScore * 0.30 +

trustScore * 0.20 +

liquidityScore * 0.15

);



let state="STABLE_ASSET";


if(brainScore>=75){

state="GROWING_ASSET";

}


if(brainScore>=90){

state="HIGH_VALUE_ASSET";

}



res.json({

system:"apren-dynamic-valuation-engine",


asset:{

id:asset.id,

name:asset.name

},


valuation:{

base:asset.base_value,

current:currentValue,

currency:asset.currency

},


signals:{

freshness,

demand:demandScore,

trust:trustScore,

liquidity:liquidityScore

},


brain:{

score:brainScore,

state

}

});


});





app.get("/wallet/:userId/assets",(req,res)=>{


const holdings =
db.prepare(`

SELECT

h.asset_id,
h.quantity,
h.ownership_type,

a.name,
a.base_value,
a.currency,
a.freshness_score,
a.demand

FROM food_asset_holdings h

JOIN food_assets a

ON a.id=h.asset_id

WHERE h.owner_id=?

`)
.all(req.params.userId);



const assets = holdings.map(asset=>{


const evidence =
db.prepare(`

SELECT COUNT(*) count

FROM asset_evidence

WHERE asset_id=?

`)
.get(asset.asset_id);



const freshness =
asset.freshness_score || 0;


let demandScore=50;


if(asset.demand==="High"){

demandScore=90;

}

else if(asset.demand==="Increasing"){

demandScore=75;

}

else if(asset.demand==="Steady"){

demandScore=60;

}



const trustScore=Math.min(

100,

50+(evidence.count*25)

);



const value = Number(

(

asset.base_value *

(freshness/100) *

(1+((demandScore-50)/500)) *

(1+((trustScore-50)/1000))

).toFixed(2)

);



return {

assetId:asset.asset_id,

name:asset.name,

quantity:asset.quantity,

value:value,

currency:asset.currency,

freshness:freshness,

demand:asset.demand,

trust:trustScore

};


});



const totalValue = assets.reduce(

(sum,a)=>sum+(a.value*a.quantity),

0

);



res.json({

system:"apren-food-wallet-portfolio",

user:req.params.userId,

portfolio:{

assets,

totalValue:Number(totalValue.toFixed(2)),

currency:
assets[0]?.currency || "ə"

}

});


});





app.get("/wallet/:userId/intelligence", async(req,res)=>{


try{


const axios = require("axios");


// Wallet balances

const walletResponse =
await axios.get(
`http://localhost:4002/wallet/${req.params.userId}`
);


const wallets =
walletResponse.data.wallets || [];



const fiat =
wallets.find(
w=>w.currency==="EUR"
)
||
{
currency:"EUR",
balance:0
};



const schwa =
wallets.find(
w=>w.currency==="ə"
)
||
{
currency:"ə",
balance:0
};



// Food assets

const portfolio =
db.prepare(`

SELECT

a.*,
h.quantity

FROM food_asset_holdings h

JOIN food_assets a

ON a.id=h.asset_id

WHERE h.owner_id=?

`)
.all(req.params.userId);



let totalValue=0;

let freshnessTotal=0;

let strongest=null;

let demandLeader=null;



for(const asset of portfolio){


const value =

asset.base_value *

(asset.freshness_score / 100);



totalValue += value;


freshnessTotal += asset.freshness_score;



if(!strongest ||
value > strongest.value){

strongest={

name:asset.name,

value:Number(value.toFixed(2))

};

}



if(!demandLeader){

demandLeader=asset.name;

}


if(asset.demand==="High"){

demandLeader=asset.name;

}


}



const freshnessHealth =
portfolio.length
?
Math.round(
freshnessTotal / portfolio.length
)
:
0;



const brainScore=Math.round(

freshnessHealth * 0.35 +

(portfolio.length ? 70 : 0) * 0.25 +

(schwa.balance > 0 ? 80 : 50) * 0.20 +

(fiat.balance > 0 ? 80 : 50) * 0.20

);



let recommendation =
"MAINTAIN";

if(brainScore>=80){

recommendation=
"OPTIMIZE FOOD FLOW";

}

if(brainScore>=90){

recommendation=
"MAXIMIZE FOOD VALUE";

}



res.json({

system:"apren-food-wallet-intelligence",


wallet:{


fiat,

schwa,


foodAssets:{

count:portfolio.length,

value:Number(totalValue.toFixed(2)),

currency:"ə"

}


},


intelligence:{


freshnessHealth,

strongestAsset:
strongest,

demandLeader,


risk:
freshnessHealth < 70
?
"HIGH"
:
"LOW"


},


brain:{


score:brainScore,

recommendation


}


});


}catch(error){


res.status(500).json({

error:"Wallet intelligence unavailable",

details:error.message

});


}


});





app.get("/assets/:id/events",(req,res)=>{


const events =
db.prepare(`

SELECT *

FROM asset_events

WHERE asset_id=?

ORDER BY id ASC

`)
.all(req.params.id);



res.json({

system:"apren-food-event-stream",

assetId:req.params.id,

events

});


});





app.post("/economy/create", async(req,res)=>{

try{

const asset =
await foodTransactionEngine.createFoodEconomyTransaction(
req.body
);


res.json({

success:true,

asset

});


}

catch(error){

console.error(error);

res.status(500).json({

error:error.message

});

}


});



app.post("/economy/trade", async(req,res)=>{

try{

const result =
await tradeEngine.executeTrade(req.body);


res.json({

success:true,

transaction:result

});

}

catch(error){

console.error(error);

res.status(500).json({

error:error.message

});

}

});




app.get("/portfolio/:userId", async(req,res)=>{

try{

const result =
await portfolioEngine.getPortfolio(
req.params.userId
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/wallet/fund", async(req,res)=>{

try{

const result =
await fundingEngine.fundWallet(req.body);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/economy/trade-preview", async(req,res)=>{

try{

const result =
await tradePreview.previewTrade(req.body);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});





app.post("/food/evidence/analyze", async(req,res)=>{

try{


const result =
await foodEvidenceEngine.analyzeEvidence(
req.body
);


res.json(result);


}

catch(error){

res.status(500).json({
error:error.message
});

}


});




app.post("/food/passport/create", async(req,res)=>{

try{

const result =
await passportEngine.createPassport(req.body);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


app.get("/food/passport/:assetId", async(req,res)=>{

try{

const result =
await passportEngine.getPassport(
req.params.assetId
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});





app.post("/rules/evaluate", async(req,res)=>{

try{

const result =
await ruleEngine.evaluate(
req.body
);


res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});





app.post("/food/lifecycle/update", async(req,res)=>{

try{


const result =
await lifecycleEngine.updateLifecycle(
req.body
);


res.json({

success:true,

lifecycle:result

});


}

catch(error){

res.status(500).json({

error:error.message

});

}


});



app.get("/food/lifecycle/:assetId", async(req,res)=>{


try{


const result =
await lifecycleEngine.getLifecycle(
req.params.assetId
);


res.json(result);


}

catch(error){

res.status(500).json({

error:error.message

});

}


});






app.post("/food/intelligence/evaluate/:assetId", async(req,res)=>{

try{


const result =
await decisionEngine.evaluateAsset(
req.params.assetId
);


res.json(result);


}

catch(error){

res.status(500).json({
error:error.message
});

}


});



app.get("/food/intelligence/:assetId", async(req,res)=>{

try{


const result =
await decisionEngine.history(
req.params.assetId
);


res.json(result);


}

catch(error){

res.status(500).json({
error:error.message
});

}

});





app.post("/brain/analyze/:assetId", async(req,res)=>{

try{

const result =
await foodBrainEngine.analyze(
req.params.assetId
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/history/:assetId", async(req,res)=>{

try{

const result =
await foodBrainEngine.history(
req.params.assetId
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});





app.post("/brain/orchestrate/:assetId", async(req,res)=>{

try{


const result =
await foodBrainOrchestrator.orchestrate(
req.params.assetId
);


res.json(result);


}

catch(error){

res.status(500).json({
error:error.message
});

}


});



app.get("/brain/cycles/:assetId", async(req,res)=>{

try{


const result =
await foodBrainOrchestrator.history(
req.params.assetId
);


res.json(result);


}

catch(error){

res.status(500).json({
error:error.message
});

}


});




app.post("/brain/memory/store", async(req,res)=>{

try{

const result =
await brainMemoryEngine.storeMemory(
req.body
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/memory/:assetId", async(req,res)=>{

try{

res.json(
await brainMemoryEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/learn/:assetId", async(req,res)=>{

try{

res.json(
await brainMemoryEngine.learn(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/brain/predict/:assetId", async(req,res)=>{

try{

res.json(
await predictionEngine.predict(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/predictions/:assetId", async(req,res)=>{

try{

res.json(
await predictionEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});




app.post("/brain/feedback/store", async(req,res)=>{

try{

res.json(
await feedbackEngine.recordFeedback(
req.body
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/feedback/:assetId", async(req,res)=>{

try{

res.json(
await feedbackEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/accuracy/:assetId", async(req,res)=>{

try{

res.json(
await accuracyEngine.calculate(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/adapt/:assetId", async(req,res)=>{

try{

res.json(
await adaptationEngine.adapt(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});





app.post("/brain/action/create/:assetId", async(req,res)=>{

try{

res.json(
await actionEngine.createAction(
req.params.assetId,
req.body
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/actions/:assetId", async(req,res)=>{

try{

res.json(
await actionEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/brain/action/execute/:actionId", async(req,res)=>{

try{

res.json(
await automationEngine.execute(
req.params.actionId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});




app.post("/brain/optimize/:assetId", async(req,res)=>{

try{

res.json(
await optimizationEngine.optimize(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


app.get("/brain/strategy/:assetId", async(req,res)=>{

try{

res.json(
await optimizationEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


app.post("/brain/evolve/:assetId", async(req,res)=>{

try{

res.json(
await ruleEvolutionEngine.evolve(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


app.get("/brain/evolution/:assetId", async(req,res)=>{

try{

res.json(
await ruleEvolutionEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/brain/council/:assetId", async(req,res)=>{

try{

res.json(
await agentCouncilEngine.decide(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


app.get("/brain/council/history/:assetId", async(req,res)=>{

try{

res.json(
await agentCouncilEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/brain/govern/:assetId", async(req,res)=>{

try{

res.json(
await executiveGovernor.govern(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


app.get("/brain/govern/history/:assetId", async(req,res)=>{

try{

res.json(
await executiveGovernor.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});




app.post("/economy/value/:assetId", async(req,res)=>{

try{

res.json(
await valuationEngine.evaluate(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/economy/value/history/:assetId", async(req,res)=>{

try{

res.json(
await valuationEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/economy/pulse", async(req,res)=>{

try{

res.json(
marketPulseEngine.analyze(
req.body
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/economy/event", async(req,res)=>{

try{

res.json(
await economicEventEngine.record(
req.body
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/economy/events/:assetId", async(req,res)=>{

try{

res.json(
await economicEventEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});





app.post("/market/supply/:assetId", async(req,res)=>{

try{

res.json(
await supplyIntelligenceEngine.record(
req.params.assetId,
req.body
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/market/forecast/:assetId", async(req,res)=>{

try{

res.json(
await demandForecastEngine.forecast(
req.params.assetId,
req.body
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/market/intelligence/:assetId", async(req,res)=>{

try{

res.json(
await marketIntelligenceEngine.analyze(
req.params.assetId,
req.body
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


app.listen(4003,()=>{

console.log(
"āprən Food Asset Engine running on 4003"
);

});


const freshness =
require("./freshnessPredictionEngine");

const value =
require("./valueForecastEngine");

const risk =
require("./riskForecastEngine");

const {pool}=require("../postgres");



async function predict(assetId,data){


const freshnessScore =
freshness.predict(
data.hoursRemaining || 24
);



const predictedValue =
value.forecast(
data.currentValue || 0,
freshnessScore
);



const riskLevel =
risk.evaluate(
freshnessScore
);



let action="HOLD";


if(riskLevel==="HIGH"){

action="SELL_NOW";

}

else if(riskLevel==="MEDIUM"){

action="PROMOTE";

}



const result =
await pool.query(
`
INSERT INTO food_brain_predictions
(
asset_id,
prediction_type,
current_value,
predicted_value,
freshness_prediction,
confidence,
recommended_action,
reason
)

VALUES
($1,$2,$3,$4,$5,$6,$7,$8)

RETURNING *
`,
[
assetId,
"FOOD_VALUE_FORECAST",
data.currentValue || 0,
predictedValue,
freshnessScore,
85,
action,
"Prediction generated from freshness and value signals"
]
);



return {

asset_id:assetId,

prediction:{
freshness:freshnessScore,
risk:riskLevel
},

forecast:{
current_value:data.currentValue || 0,
predicted_value:predictedValue
},

recommendation:{
action,
reason:"Value preservation based on forecast"
},

confidence:85,

record:result.rows[0]

};

}



module.exports={
predict
};


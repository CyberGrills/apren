

const demand =
require("./demandPredictionEngine");

const freshness =
require("./freshnessPredictionEngine");

const value =
require("./valuePredictionEngine");


const {pool}=require("../postgres");



async function predict(assetId,data){


const predictions=[

demand.predict(data),

freshness.predict(data),

value.predict(data)

];



let confidence = Math.round(

predictions.reduce(
(a,b)=>a+b.confidence,0
)
/ predictions.length

);



const result={

future_state:predictions,

overall_confidence:confidence

};



await pool.query(
`
INSERT INTO food_brain_predictions
(
asset_id,
prediction_type,
input_state,
prediction,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
"AUTONOMOUS_FORECAST",
JSON.stringify(data),
JSON.stringify(result),
confidence
]
);



return {

asset_id:assetId,

prediction:result

};


}


module.exports={
predict
};



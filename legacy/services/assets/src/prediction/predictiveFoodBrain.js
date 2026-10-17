

const freshness =
require("./freshnessPredictionEngine");

const demand =
require("./demandForecastEngine");

const value =
require("./valueForecastEngine");

const waste =
require("./wasteRiskPredictionEngine");

const {pool}=require("../postgres");



async function predict(assetId,data){


const results={

freshness:freshness.predict(data),

demand:demand.forecast(data),

value:value.forecast(data),

waste:waste.predict(data)

};



let strongest =
results.freshness;


if(results.waste.confidence > strongest.confidence)
strongest=results.waste;


if(results.demand.confidence > strongest.confidence)
strongest=results.demand;



await pool.query(
`
INSERT INTO food_brain_predictions
(
asset_id,
prediction_type,
prediction,
recommended_action,
reasoning,
confidence
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
assetId,
"FOOD_FORECAST",
JSON.stringify({
prediction: strongest.prediction
}),
strongest.action,
JSON.stringify(results),
strongest.confidence
]
);



return {

asset_id:assetId,

predictions:results,

primary_prediction:strongest

};


}



module.exports={
predict
};


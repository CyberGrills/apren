

const signal =
require("./marketSignalEngine");

const prediction =
require("./demandPredictionEngine");

const value =
require("./valueReactionEngine");

const {pool}=require("../postgres");



async function analyze(assetId,data){


const storedSignal =
await signal.record({

assetId,

signal:
"MARKET_CHANGE",

context:data,

impact:data.impact || 50

});



const forecast =
prediction.predict(data);



const valuation =
value.react(data);



await pool.query(
`
INSERT INTO food_brain_market_predictions
(
asset_id,
prediction,
reasoning,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
forecast.prediction,
JSON.stringify(data),
forecast.confidence
]
);



await pool.query(
`
INSERT INTO food_brain_value_reactions
(
asset_id,
previous_value,
new_value,
reaction
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
data.value || 50,
valuation.newValue,
valuation.reaction
]
);



return {

asset_id:assetId,

signal:storedSignal,

market_prediction:forecast,

value_reaction:valuation

};


}



module.exports={
analyze
};


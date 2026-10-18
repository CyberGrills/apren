

const collector =
require("./memoryCollectorEngine");

const pattern =
require("./patternRecognitionEngine");

const prediction =
require("./futurePredictionEngine");

const {pool}=require("../postgres");



async function fuse(assetId,data){


const memories =
await collector.collect(
assetId,
data
);



const learned =
pattern.analyze(
memories
);



const future =
prediction.predict(
learned
);



await pool.query(
`
INSERT INTO food_brain_memory_patterns
(
asset_id,
pattern,
pattern_data,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
learned.pattern,
JSON.stringify(memories),
learned.confidence
]
);



await pool.query(
`
INSERT INTO food_brain_future_predictions
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
future.prediction,
JSON.stringify(learned),
future.confidence
]
);



return {

asset_id:assetId,

memory_count:memories.length,

pattern:learned,

future_prediction:future

};


}



module.exports={
fuse
};


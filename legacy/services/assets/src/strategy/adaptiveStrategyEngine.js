
const evolution =
require("./strategyEvolutionEngine");


const {pool}=require("../postgres");



async function adapt(assetId,data){


const evolved =
await evolution.evolve(
assetId,
data
);



await pool.query(
`
INSERT INTO food_brain_strategy_evolution
(
asset_id,
previous_strategy,
new_strategy,
reason,
evolution_score
)

VALUES
($1,$2,$3,$4,$5)
`,
[
assetId,
data.previousStrategy,
evolved.strategy,
JSON.stringify(data.result),
evolved.confidence
]
);



return {

asset_id:assetId,

adaptive_strategy:evolved.strategy,

confidence:evolved.confidence,

message:
"Strategy evolved from experience"

};

}



module.exports={
adapt
};


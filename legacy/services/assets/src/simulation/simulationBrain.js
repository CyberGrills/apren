

const generator =
require("./scenarioGenerator");

const simulator =
require("./outcomeSimulator");


const {pool}=require("../postgres");



async function simulate(assetId,data){


const scenarios =
generator.generate(data);


let results=[];


for(const scenario of scenarios){


const outcome =
simulator.simulate(
scenario,
data
);


results.push(outcome);



await pool.query(
`
INSERT INTO food_brain_simulations
(
asset_id,
scenario,
inputs,
predicted_outcome,
score,
confidence
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
assetId,
scenario.name,
JSON.stringify(data),
JSON.stringify(outcome),
outcome.score,
Math.min(outcome.score,100)
]
);


}



results.sort(
(a,b)=>b.score-a.score
);



const winner=results[0];



await pool.query(
`
INSERT INTO food_brain_simulation_results
(
asset_id,
selected_scenario,
reason
)

VALUES($1,$2,$3)
`,
[
assetId,
winner.scenario,
JSON.stringify(winner)
]
);



return {

asset_id:assetId,

simulations:results,

recommended_path:winner

};


}



module.exports={
simulate
};



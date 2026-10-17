const scenarios =
require("./scenarioGenerator");

const predictor =
require("./futureStatePredictor");

const evaluator =
require("./impactEvaluationEngine");

const {pool}=require("../postgres");



async function simulate(assetId,data){


const generated =
scenarios.generate(data);



const simulations=[];



for(const scenario of generated){


const prediction =
predictor.predict(
data,
scenario
);


const impact =
evaluator.evaluate(
prediction
);



const result =
await pool.query(
`
INSERT INTO food_brain_simulations
(
asset_id,
scenario,
prediction,
impact
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
scenario.scenario,
JSON.stringify(prediction),
JSON.stringify(impact)
]
);



simulations.push(result.rows[0]);


}



return {

asset_id:assetId,

simulations

};


}



async function history(assetId){


const result =
await pool.query(
`
SELECT *
FROM food_brain_simulations
WHERE asset_id=$1
ORDER BY created_at DESC
LIMIT 50
`,
[assetId]
);


return result.rows;

}



module.exports={
simulate,
history
};

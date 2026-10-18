#!/bin/bash
set -e

echo "=== āprən Food Brain Predictive Simulation Engine Layer 10 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer10-predictive-simulation

cp -r services/assets/src \
backups/layer10-predictive-simulation/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating predictive modules ==="

mkdir -p services/assets/src/predictive



cat > services/assets/src/predictive/scenarioGenerator.js <<'JS'
function generate(data){

return [

{
scenario:"SELL_NOW",
hours:0,
action:"SELL"
},

{
scenario:"HOLD",
hours:data.future_hours || 12,
action:"WAIT"
},

{
scenario:"PROMOTE",
hours:6,
action:"BOOST"
},

{
scenario:"TRADE",
hours:3,
action:"EXCHANGE"
}

];

}


module.exports={
generate
};
JS





cat > services/assets/src/predictive/futureStatePredictor.js <<'JS'
function predict(data,scenario){


let freshness =
data.freshness || 100;


let demand =
data.demand || 50;


let value =
data.value || 0;



if(scenario.action==="WAIT"){

freshness -= scenario.hours * 2;

}


if(scenario.action==="BOOST"){

demand += 15;

}


if(scenario.action==="EXCHANGE"){

value += 5;

}



return {

scenario:scenario.scenario,

future_hours:scenario.hours,

prediction:{

freshness:Math.max(freshness,0),

demand,

value,

risk:
freshness < 30
?"HIGH"
:"NORMAL"

}

};

}



module.exports={
predict
};
JS





cat > services/assets/src/predictive/impactEvaluationEngine.js <<'JS'
function evaluate(prediction){


let protection=50;


let waste=50;


let benefit=50;



if(prediction.prediction.freshness > 70){

protection=90;

waste=95;

}


if(prediction.prediction.demand > 80){

benefit=90;

}



return {

scenario:prediction.scenario,

scores:{

value_protection:protection,

waste_prevention:waste,

user_benefit:benefit

}

};

}



module.exports={
evaluate
};
JS






cat > services/assets/src/predictive/predictiveSimulationEngine.js <<'JS'
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
JS





echo "=== Creating predictive database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_simulations
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

scenario TEXT,

prediction JSONB,

impact JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_simulation_asset
ON food_brain_simulations(asset_id);



SQL





echo "=== Adding predictive routes ==="


python3 <<'PY'

from pathlib import Path


path=Path("services/assets/src/server.js")

text=path.read_text()



if "predictiveSimulationEngine" not in text:

    text=text.replace(
    'const adaptiveIntelligenceEngine',
    '''const predictiveSimulationEngine = require("./predictive/predictiveSimulationEngine");

const adaptiveIntelligenceEngine'''
    )



routes="""


app.post("/brain/simulation/run/:assetId", async(req,res)=>{

try{

res.json(
await predictiveSimulationEngine.simulate(
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



app.get("/brain/simulation/history/:assetId", async(req,res)=>{

try{

res.json(
await predictiveSimulationEngine.history(
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


"""



if "/brain/simulation/run/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY





echo "=== Testing predictive modules ==="


node - <<'NODE'

require("./services/assets/src/predictive/scenarioGenerator");

require("./services/assets/src/predictive/futureStatePredictor");

require("./services/assets/src/predictive/impactEvaluationEngine");

require("./services/assets/src/predictive/predictiveSimulationEngine");


console.log(
"Layer 10 predictive simulation loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 10 COMPLETE ==="

echo "Next:"
echo "1. restart assets service"
echo "2. test simulation"
echo "3. git commit + tag"


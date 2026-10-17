#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Agent Orchestration Engine v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-agent-orchestration-v1

cp -r services/assets/src \
backups/food-brain-agent-orchestration-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating orchestration modules ==="

mkdir -p services/assets/src/agents



cat > services/assets/src/agents/agentCommunicationEngine.js <<'JS'
const {pool}=require("../postgres");


async function broadcast(data){

const result =
await pool.query(
`
INSERT INTO food_brain_agent_messages
(
agent,
message,
confidence,
payload
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.agent,
data.message,
data.confidence || 0,
JSON.stringify(data.payload || {})
]
);


return result.rows[0];

}



async function history(){

const result =
await pool.query(
`
SELECT *
FROM food_brain_agent_messages
ORDER BY id DESC
LIMIT 100
`
);


return result.rows;

}



module.exports={
broadcast,
history
};
JS





cat > services/assets/src/agents/agentCoordinator.js <<'JS'
function coordinate(signals){


const responses=[];


if(signals.freshness !== undefined){

responses.push({

agent:"freshness",

signal:signals.freshness < 30
? "RISK"
: "NORMAL"

});

}



if(signals.demand !== undefined){

responses.push({

agent:"market",

signal:signals.demand > 70
? "HIGH_DEMAND"
: "NORMAL"

});

}



if(signals.confidence !== undefined){

responses.push({

agent:"trust",

signal:signals.confidence > 70
? "TRUSTED"
: "LOW_CONFIDENCE"

});

}



return responses;

}



module.exports={
coordinate
};
JS





cat > services/assets/src/agents/agentExecutionEngine.js <<'JS'
function execute(action){


let result="WAIT";


switch(action){

case "FAST_MOVE":

result="NOTIFY_SELLER";

break;


case "PROMOTE":

result="BOOST_VISIBILITY";

break;


case "INCREASE_SUPPLY":

result="ALERT_SUPPLIER";

break;


default:

result="MONITOR";

}



return {

action,

execution:result

};

}



module.exports={
execute
};
JS





cat > services/assets/src/agents/agentOrchestrationEngine.js <<'JS'
const coordinator =
require("./agentCoordinator");


const execution =
require("./agentExecutionEngine");


const communication =
require("./agentCommunicationEngine");



async function orchestrate(assetId,data){


const council =
coordinator.coordinate(data);



let action="HOLD";


if(
data.freshness < 30 &&
data.demand > 70
){

action="FAST_MOVE";

}
else if(
data.demand > 80
){

action="PROMOTE";

}
else if(
data.supply < data.demand
){

action="INCREASE_SUPPLY";

}



const result =
execution.execute(action);



await communication.broadcast({

agent:"orchestrator",

message:
"Agent council decision generated",

confidence:
data.confidence || 50,

payload:{
assetId,
council,
result
}

});



return {

asset_id:assetId,

council,

decision:result

};

}



module.exports={
orchestrate
};
JS





echo "=== Creating agent database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_agent_messages
(
id SERIAL PRIMARY KEY,

agent TEXT,

message TEXT,

confidence NUMERIC(5,2),

payload JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_agent_messages_agent
ON food_brain_agent_messages(agent);



SQL





echo "=== Adding orchestration routes ==="


python3 <<'PY'

from pathlib import Path


path=Path("services/assets/src/server.js")

text=path.read_text()



if "agentOrchestrationEngine" not in text:

    text=text.replace(
    'const decisionEngine',
    '''const agentOrchestrationEngine = require("./agents/agentOrchestrationEngine");

const decisionEngine'''
    )



routes="""


app.post("/brain/agents/orchestrate/:assetId", async(req,res)=>{

try{

res.json(
await agentOrchestrationEngine.orchestrate(
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


"""



if "/brain/agents/orchestrate/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY





echo "=== Testing agent modules ==="


node - <<'NODE'

require("./services/assets/src/agents/agentCommunicationEngine");

require("./services/assets/src/agents/agentCoordinator");

require("./services/assets/src/agents/agentExecutionEngine");

require("./services/assets/src/agents/agentOrchestrationEngine");

console.log(
"Food brain agent orchestration loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 6 COMPLETE ==="

echo "Next:"
echo "1. restart assets service"
echo "2. test agent orchestration"
echo "3. git commit + tag"



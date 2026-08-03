#!/bin/bash
set -e

echo "=== āprən Rule Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/rule-engine-v1

cp -r services/assets/src \
backups/rule-engine-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating rule engine module ==="

mkdir -p services/assets/src/rules



cat > services/assets/src/rules/ruleEngine.js <<'JS'
const { pool } = require("../postgres");


async function loadRules(){

const result =
await pool.query(
`
SELECT *
FROM economy_rules
WHERE active=true
ORDER BY priority DESC
`
);

return result.rows;

}



function evaluateCondition(rule,context){

switch(rule.condition_type){


case "FRESHNESS_BELOW":

return Number(context.freshness)
<
Number(rule.threshold);



case "FRESHNESS_ZERO":

return Number(context.freshness) <= 0;



case "TRUST_BELOW":

return Number(context.trust)
<
Number(rule.threshold);



case "DEMAND_HIGH":

return Number(context.demand)
>
Number(rule.threshold);



case "SUPPLY_LOW":

return Number(context.supply)
<
Number(rule.threshold);



default:

return false;

}

}



async function evaluate(context){

const rules =
await loadRules();


const results=[];


for(const rule of rules){

const triggered =
evaluateCondition(
rule,
context
);


if(triggered){

results.push({

rule:rule.name,

action:rule.action,

message:rule.description

});

}

}


return {

allowed:
!results.some(
r=>r.action==="BLOCK"
),

warnings:
results.filter(
r=>r.action==="WARN"
),

actions:
results

};

}



module.exports={
evaluate
};
JS



echo "=== Creating rule table ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS economy_rules
(
id SERIAL PRIMARY KEY,

name TEXT UNIQUE,

condition_type TEXT NOT NULL,

threshold NUMERIC,

action TEXT NOT NULL,

description TEXT,

priority INTEGER DEFAULT 0,

active BOOLEAN DEFAULT true,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



INSERT INTO economy_rules
(
name,
condition_type,
threshold,
action,
description,
priority
)

VALUES

(
'BLOCK_EXPIRED_FOOD',
'FRESHNESS_ZERO',
0,
'BLOCK',
'Expired food cannot enter trade',
100
),

(
'WARN_LOW_FRESHNESS',
'FRESHNESS_BELOW',
40,
'WARN',
'Food is approaching expiry',
50
),

(
'LOW_TRUST_REVIEW',
'TRUST_BELOW',
30,
'WARN',
'Asset requires trust review',
40
),

(
'HIGH_DEMAND_SIGNAL',
'DEMAND_HIGH',
80,
'MODIFY',
'High demand valuation adjustment',
20
)

ON CONFLICT(name) DO NOTHING;


SQL



echo "=== Adding rule API ==="


python3 <<'PY'

from pathlib import Path

path=Path(
"services/assets/src/server.js"
)

text=path.read_text()


if "ruleEngine" not in text:

    text=text.replace(
    'const passportEngine',
    'const ruleEngine = require("./rules/ruleEngine");\n\nconst passportEngine'
    )


route="""


app.post("/rules/evaluate", async(req,res)=>{

try{

const result =
await ruleEngine.evaluate(
req.body
);


res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


"""


if "/rules/evaluate" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+route+text[insert:]


path.write_text(text)

PY



echo "=== Testing rule engine ==="


node - <<'NODE'

require("./services/assets/src/rules/ruleEngine");

console.log(
"Rule engine loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test rules"


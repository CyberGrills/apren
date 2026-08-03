

const planner =
require("./actionPlannerEngine");

const confidence =
require("./actionConfidenceEngine");

const memory =
require("./executionMemoryEngine");

const {pool}=require("../postgres");



async function decide(assetId,data){


let plan =
planner.plan(data);



plan.confidence =
confidence.evaluate(plan);



const saved =
await pool.query(
`
INSERT INTO food_brain_action_plans
(
asset_id,
action,
priority,
reasoning,
confidence,
requires_approval
)

VALUES($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
plan.action,
plan.priority,
JSON.stringify(plan.reasoning),
plan.confidence,
true
]
);



return {

asset_id:assetId,

autonomous_plan:saved.rows[0],

message:
"Action planned. Approval required before execution."

};


}



module.exports={
decide
};


const risk =
require("./riskEvaluationEngine");

const permission =
require("./permissionMemoryEngine");

const policy =
require("./approvalPolicyEngine");

const trust =
require("./trustAssessmentEngine");

const {pool}=require("../postgres");



async function evaluate(assetId,data){


const riskResult =
risk.evaluate(
data.action,
data.confidence || 0
);



const userPermission =
permission.getPermission(
data.userId || "default"
);



const approval =
policy.approve(
riskResult.risk,
userPermission
);



const trustScore =
trust.assess({
execution_status:"PENDING",
risk:riskResult.risk
});



const record =
await pool.query(
`
INSERT INTO food_brain_trust_events
(
asset_id,
action,
risk_level,
confidence,
approval_mode,
governor_decision
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
data.action,
riskResult.risk,
data.confidence || 0,
approval.mode,
approval.approved
]
);



return {

asset_id:assetId,

risk:riskResult,

permission:userPermission,

approval,

trust:trustScore,

record:record.rows[0]

};

}



module.exports={
evaluate
};

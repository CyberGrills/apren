const risk =
require("./riskGovernor");


const trust =
require("./trustGovernor");


const economy =
require("./economicGovernor");


const approval =
require("./finalApprovalEngine");


const {pool}=require("../postgres");



async function govern(assetId,data){


const riskResult =
risk.evaluate(data);


const trustResult =
trust.evaluate(data);


const economyResult =
economy.evaluate(data);



const final =
approval.approve({

risk:riskResult.risk,

trust:trustResult.trust

});



const result =
await pool.query(
`
INSERT INTO food_brain_governor_decisions
(
asset_id,
risk,
trust,
economic_status,
decision,
signals
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
riskResult.risk,
trustResult.trust,
economyResult.economic_status,
final,
JSON.stringify({
risk:riskResult,
trust:trustResult,
economy:economyResult
})
]
);



return {

asset_id:assetId,

governor:{
risk:riskResult,
trust:trustResult,
economy:economyResult,
decision:final
},

record:result.rows[0]

};

}



module.exports={
govern
};

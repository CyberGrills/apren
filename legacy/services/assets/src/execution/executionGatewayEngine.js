

const trust =
require("./trustGateEngine");

const router =
require("./executionRouterEngine");

const {pool}=require("../postgres");



async function execute(assetId,data){


const permission =
trust.evaluate(data);



if(!permission.approved){

return {

status:"WAITING_APPROVAL",

reason:"Trust gate blocked execution"

};

}



const destination =
router.route(data.action);


/*
 * āprən safety boundary:
 * SIMULATED execution must never enqueue a real execution request.
 * The gateway remains the controlled execution boundary while the
 * autonomous Agent Kernel is being validated.
 */

if (data.executionMode === "SIMULATED") {

return {

status: "SIMULATED",

action: data.action,

destination,

message: "Execution gateway completed a safe simulated execution."

};

}


const result =
await pool.query(
`
INSERT INTO food_brain_execution_queue
(
asset_id,
action,
execution_status,
priority,
payload,
approved
)

VALUES($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
data.action,
"STARTED",
data.confidence,
JSON.stringify({
destination
}),
true
]
);



return {

status:"EXECUTION_STARTED",

destination,

execution:result.rows[0]

};


}



module.exports={
execute
};


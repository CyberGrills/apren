
const pipeline =
require("./intelligencePipelineEngine");

const optimizer =
require("./economyOptimizationEngine");

const feedback =
require("./learningFeedbackEngine");

const {pool}=require("../postgres");



async function orchestrate(assetId,data){


const brainPipeline =
pipeline.pipeline(data);



const optimization =
optimizer.optimize(data);



const decision = {

action:
optimization.confidence >= 80
?
"PROMOTE"
:
"HOLD",

confidence:
optimization.confidence

};



const execution = {

status:"READY",

mode:data.autonomy || "ASSISTED"

};



const run =
await pool.query(
`
INSERT INTO food_brain_orchestration_runs
(
asset_id,
stage,
input_signals,
decision_output,
execution_output,
confidence
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
"COMPLETE",

JSON.stringify(
brainPipeline
),

JSON.stringify(
decision
),

JSON.stringify(
execution
),

optimization.confidence
]
);



await feedback.record({

assetId,

stage:"ORCHESTRATION",

type:"CYCLE_COMPLETE",

data:{
decision,
execution
},

score:
optimization.confidence

});



return {

asset_id:assetId,

brain_cycle:{

pipeline:brainPipeline,

decision,

execution

},

confidence:
optimization.confidence,

run:run.rows[0]

};

}



module.exports={
orchestrate
};


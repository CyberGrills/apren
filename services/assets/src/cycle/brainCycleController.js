

const decisionLoop =
require("./decisionLoopEngine");


const feedback =
require("./cycleFeedbackEngine");


async function execute(assetId,data){


const decision =
await decisionLoop.run(
assetId,
data
);



return {

cycle:"COMPLETE",

asset_id:assetId,

decision,

feedback_ready:true

};


}



module.exports={
execute
};



const accuracy =
require("./accuracyEngine");


async function adapt(assetId){


const result =
await accuracy.calculate(assetId);



let mode="STANDARD";


if(
result.accuracy_score >=80
){

mode="HIGH_CONFIDENCE";

}

else if(
result.accuracy_score <50 &&
result.sample_size>3
){

mode="CAUTIOUS";

}



return {

asset_id:assetId,

brain_mode:mode,

accuracy:result.accuracy_score,

sample_size:result.sample_size

};


}



module.exports={
adapt
};

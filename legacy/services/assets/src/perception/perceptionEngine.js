const recognition =
require("./foodRecognitionEngine");

const freshness =
require("./freshnessVisionEngine");

const expiry =
require("./expiryPredictionEngine");

const observation =
require("./observationEngine");



async function analyze(data){


const food =
recognition.recognize(data);



const fresh =
freshness.analyze(data);



const exp =
expiry.predict(
fresh.freshness_score
);



const result =
await observation.save({

asset_id:data.asset_id,

image_reference:data.image_reference,

video_reference:data.video_reference,

detected_food:food.food,

freshness_score:fresh.freshness_score,

expiry_hours:exp.expiry_hours,

confidence:
Math.round(
(
food.confidence+
fresh.confidence
)
/2
)

});



return {

observation:result,

intelligence:{

food:food.food,

freshness_score:fresh.freshness_score,

expiry_hours:exp.expiry_hours,

confidence:result.confidence

}

};


}



module.exports={
analyze
};



function predict(pattern){


let prediction="STABLE";


if(pattern.pattern==="FAST_DISTRIBUTION_PATTERN"){

prediction="EARLY_MOVEMENT_REQUIRED";

}


return {

prediction,

confidence:pattern.confidence

};


}



module.exports={
predict
};


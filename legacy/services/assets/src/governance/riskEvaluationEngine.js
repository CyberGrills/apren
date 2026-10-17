function evaluate(action, confidence){

let risk="HIGH";


if(confidence >=90){
risk="LOW";
}
else if(confidence >=70){
risk="MEDIUM";
}


return {

action,

confidence,

risk

};

}


module.exports={
evaluate
};

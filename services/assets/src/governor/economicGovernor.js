function evaluate(data){

let status="STABLE";


if(
data.value_drop &&
data.value_drop > 50
){

status="VALUE_PROTECTION";

}


return {

economic_status:status

};

}


module.exports={
evaluate
};



function evaluate(data){


let approved=false;


if(
data.approved === true &&
data.confidence >= 90
){

approved=true;

}


return {

approved,

risk:
approved
?
"LOW"
:
"HIGH"

};

}



module.exports={
evaluate
};


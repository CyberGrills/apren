

function decide(outputs,data){


let action="HOLD";

let confidence=70;


const signals =
outputs.map(x=>x.agent);



if(
data.freshness < 40 &&
data.demand==="HIGH"
){

action="PROMOTE_AND_DISTRIBUTE";

confidence=94;

}


return {

action,

confidence,

agents:signals

};


}



module.exports={
decide
};


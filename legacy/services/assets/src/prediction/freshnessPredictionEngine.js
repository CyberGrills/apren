

function predict(data){


let status="SAFE";

let confidence=70;



if(data.freshness < 15){

status="CRITICAL";

confidence=95;

}
else if(data.freshness < 30){

status="DECLINING";

confidence=85;

}


return {

prediction:"FRESHNESS_"+status,

confidence

};


}


module.exports={
predict
};


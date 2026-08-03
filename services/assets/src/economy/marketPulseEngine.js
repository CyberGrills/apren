function analyze(data){


const freshness =
Number(data.freshness || 0);


const demand =
Number(data.demand || 0);



let signal="STABLE";


if(freshness<=0){

signal="EXPIRED";

}

else if(
freshness<30 &&
demand>70
){

signal="URGENT";

}

else if(
demand>80 &&
freshness>70
){

signal="RISING";

}

else if(
demand<30
){

signal="DECLINING";

}



return {

signal,

freshness,

demand

};

}



module.exports={
analyze
};

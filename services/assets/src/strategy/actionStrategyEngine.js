

function create(data,analysis){


let strategy="MONITOR";

let steps=[];



if(data.freshness < 20){

strategy="FAST_DISTRIBUTION";

steps.push(
"move asset before freshness loss"
);

steps.push(
"activate nearby demand"
);

}



if(data.demand==="HIGH"){

steps.push(
"increase market visibility"
);

}



if(analysis.balance > 50){

steps.push(
"maximize asset value"
);

}



return {

strategy,

steps

};

}


module.exports={
create
};


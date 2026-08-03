
function adapt(confidence,status){


let updated=Number(confidence || 0);


if(status==="SUCCESS"){

updated += 5;

}


if(status==="FAILURE"){

updated -= 10;

}


if(updated>100){

updated=100;

}


if(updated<0){

updated=0;

}



return updated;

}



module.exports={
adapt
};


function approve(signals){


let decision="APPROVE";


if(
signals.risk === "HIGH"
){

decision="BLOCK";

}


if(
signals.trust === "REVIEW_REQUIRED"
){

decision="REVIEW";

}


return decision;

}



module.exports={
approve
};

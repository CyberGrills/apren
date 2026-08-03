
function adjust(data){

let confidence=50;


if(data.accuracy >= 90){

confidence=90;

}
else if(data.accuracy >= 70){

confidence=70;

}
else if(data.accuracy < 50){

confidence=40;

}


return {

confidence,

status:
confidence >=70
?"TRUSTED"
:"REVIEW"

};

}


module.exports={
adjust
};


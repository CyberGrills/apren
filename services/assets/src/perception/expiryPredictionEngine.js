function predict(freshness){

let hours=24;


if(freshness>=90){

hours=24;

}
else if(freshness>=70){

hours=12;

}
else if(freshness>=40){

hours=6;

}
else{

hours=1;

}


return {

expiry_hours:hours

};

}


module.exports={
predict
};

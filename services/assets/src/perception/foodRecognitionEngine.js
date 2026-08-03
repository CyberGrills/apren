function recognize(data){

let food="UNKNOWN";
let confidence=50;


const input =
String(data.food_hint || "")
.toLowerCase();


if(input){

food=input;
confidence=80;

}


return {

food,

confidence

};

}


module.exports={
recognize
};

function generate(data){

return [

{
scenario:"SELL_NOW",
hours:0,
action:"SELL"
},

{
scenario:"HOLD",
hours:data.future_hours || 12,
action:"WAIT"
},

{
scenario:"PROMOTE",
hours:6,
action:"BOOST"
},

{
scenario:"TRADE",
hours:3,
action:"EXCHANGE"
}

];

}


module.exports={
generate
};

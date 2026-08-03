function authorize(action){

const allowed=[
"SELL_NOW",
"HOLD",
"PROMOTE",
"TRADE"
];


return {

authorized:
allowed.includes(action),

action,

reason:
allowed.includes(action)
?"Action approved by execution governor"
:"Action blocked"

};

}


module.exports={
authorize
};

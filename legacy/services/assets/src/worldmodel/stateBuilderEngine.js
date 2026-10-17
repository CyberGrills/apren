
function build(data){

return {

freshness:data.freshness || 0,

demand:data.demand || "NORMAL",

supply:data.supply || "NORMAL",

market:data.market || {},

timestamp:new Date()

};

}


module.exports={
build
};


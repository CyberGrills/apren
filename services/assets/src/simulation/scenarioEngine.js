
function createScenario(data){

return {

supply_change:data.supplyChange || 0,

demand_change:data.demandChange || 0,

price_change:data.priceChange || 0

};

}


module.exports={
createScenario
};


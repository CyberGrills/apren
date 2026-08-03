
const repository =
require("./repositories/assetRepository");

const valuation =
require("./intelligence/valuation");


async function createFoodAsset(data){


const value =
valuation.calculateValue({

basePrice:data.basePrice || 10,
freshness:data.freshness || 100,
demand:data.demand || 0,
trust:data.trust || 50

});


return repository.createAsset({

asset_code:data.asset_code,
current_value:value,
freshness_score:data.freshness || 100,
demand_score:data.demand || 0,
trust_score:data.trust || 50,
available_supply:data.quantity || 0

});


}


module.exports={
createFoodAsset
};


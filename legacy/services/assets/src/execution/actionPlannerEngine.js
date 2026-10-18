
function create(data){


return {

assetId:data.assetId,

action:data.action,

requirements:{

wallet:data.action==="TRADE",

market:data.action==="SELL_NOW" ||
data.action==="PROMOTE",

freshnessCheck:true

}

};


}



module.exports={
create
};


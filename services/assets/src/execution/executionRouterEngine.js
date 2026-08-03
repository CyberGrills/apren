

function route(action){


const routes={

TRADE:"TRADE_ENGINE",

DISTRIBUTE_FAST:"MARKET_ENGINE",

NOTIFY_BUYERS:"NOTIFICATION_ENGINE",

ADJUST_PRIORITY:"MARKET_ENGINE"

};


return routes[action] || "MANUAL_REVIEW";


}



module.exports={
route
};


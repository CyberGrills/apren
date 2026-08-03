function explain(decision){


const reasons={

SELL_NOW:
"Immediate movement preserves current food value",

HOLD:
"Holding allows future market opportunity",

PROMOTE:
"Promotion increases demand and reduces waste risk",

TRADE:
"Exchange improves asset utility"

};


return {

decision:decision.scenario,

reason:
reasons[decision.scenario]
||
"Optimized by food brain"

};

}


module.exports={
explain
};

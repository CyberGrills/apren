

const performance =
require("./strategyPerformanceEngine");

const {pool}=require("../postgres");



async function learn(data){


const analysis =
await performance.analyze(
data.strategy
);



let confidence =
analysis.performance;



await pool.query(
`
INSERT INTO food_brain_strategy_learning
(
strategy_type,
food_pattern,
performance_score,
usage_count,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
data.strategy,
data.pattern || "GENERAL",
analysis.performance,
analysis.usage,
confidence
]
);



return {

strategy:data.strategy,

learning:analysis

};

}



module.exports={
learn
};


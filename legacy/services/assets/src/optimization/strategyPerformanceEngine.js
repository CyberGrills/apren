

const {pool}=require("../postgres");


async function analyze(strategy){


const result =
await pool.query(
`
SELECT
AVG(success_score) as score,
COUNT(*) as usage
FROM food_brain_strategy_outcomes
WHERE strategy_type=$1
`,
[
strategy
]
);


const row=result.rows[0];


return {

strategy,

performance:
Number(row.score || 0),

usage:
Number(row.usage || 0)

};

}


module.exports={
analyze
};


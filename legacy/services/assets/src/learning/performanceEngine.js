const {pool}=require("../postgres");


async function evaluate(engine){


const result =
await pool.query(
`
SELECT
AVG(accuracy) as accuracy,
COUNT(*) as samples
FROM food_brain_learning_feedback
WHERE engine=$1
`,
[
engine
]
);



return {

engine,

accuracy:
Number(
result.rows[0].accuracy || 0
),

samples:
Number(
result.rows[0].samples || 0
)

};

}



module.exports={
evaluate
};

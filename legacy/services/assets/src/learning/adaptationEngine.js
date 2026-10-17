const {pool}=require("../postgres");


async function adapt(engine){


const performance =
await pool.query(
`
SELECT
AVG(error_score) as error
FROM food_brain_learning_feedback
WHERE engine=$1
`,
[
engine
]
);



const error =
Number(
performance.rows[0].error || 0
);



let adjustment="NO_CHANGE";


if(error>20){

adjustment="INCREASE_REVIEW";

}
else if(error<5){

adjustment="HIGH_CONFIDENCE";

}



return {

engine,

error,

adjustment

};

}



module.exports={
adapt
};

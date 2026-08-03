const { pool } = require("../postgres");


function generateAction(data){

let action="MONITOR";

let reason="Conditions stable";


const freshness =
Number(data.freshness || 0);

const demand =
Number(data.demand || 0);

const trust =
Number(data.trust || 0);



if(freshness <= 0){

action="BLOCK_TRADE";

reason="Food expired. Trading prevented.";

}

else if(
freshness < 30 &&
demand > 70
){

action="FAST_MOVE";

reason="High demand detected while freshness declines.";

}

else if(
freshness < 40
){

action="DISCOUNT";

reason="Freshness declining. Accelerate movement.";

}

else if(
freshness > 80 &&
demand > 80
){

action="BOOST_DISCOVERY";

reason="Strong freshness and market demand.";

}

else if(
trust < 30
){

action="REQUIRE_REVIEW";

reason="Trust score requires verification.";

}



return {

action,

reason

};

}



async function createAction(assetId,data){


const decision =
generateAction(data);



const result =
await pool.query(
`
INSERT INTO food_brain_actions_queue
(
asset_id,
action,
reason,
status
)

VALUES
($1,$2,$3,'PENDING')

RETURNING *
`,
[
assetId,
decision.action,
decision.reason
]
);



return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_actions_queue
WHERE asset_id=$1
ORDER BY id DESC
`,
[
assetId
]
);


return result.rows;

}



module.exports={
generateAction,
createAction,
history
};

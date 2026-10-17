const { pool } = require("../postgres");


function analyze(data){

const supply =
Number(data.supply || 0);

const demand =
Number(data.demand || 0);


let status="BALANCED";

let pressure=50;


if(supply <= 0){

status="OUT_OF_STOCK";
pressure=100;

}
else if(
supply < demand
){

status="SCARCITY";
pressure=80;

}
else if(
supply > demand * 3
){

status="OVERSUPPLY";
pressure=20;

}


return {

status,

supply,

demand,

supply_pressure:pressure

};

}



async function record(assetId,data){

const analysis =
analyze(data);


const result =
await pool.query(
`
INSERT INTO food_brain_supply_intelligence
(
asset_id,
status,
supply_amount,
demand_amount,
pressure
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
assetId,
analysis.status,
analysis.supply,
analysis.demand,
analysis.supply_pressure
]
);


return {

asset_id:assetId,

analysis,

record:result.rows[0]

};

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_supply_intelligence
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);

return result.rows;

}



module.exports={
analyze,
record,
history
};

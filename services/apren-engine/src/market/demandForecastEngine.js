const {pool}=require("../postgres");


async function forecast(assetId,data){


const current =
Number(data.current_demand || 0);


const growth =
Number(data.growth_rate || 0);



const predicted =
Math.min(
100,
Math.round(
current + (current * growth / 100)
)
);



let trend="STABLE";


if(predicted>current){

trend="RISING";

}
else if(predicted<current){

trend="DECLINING";

}



const result =
await pool.query(
`
INSERT INTO food_brain_demand_forecasts
(
asset_id,
current_demand,
predicted_demand,
trend
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
current,
predicted,
trend
]
);



return {

asset_id:assetId,

current_demand:current,

predicted_demand:predicted,

trend,

record:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_demand_forecasts
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);

return result.rows;

}



module.exports={
forecast,
history
};

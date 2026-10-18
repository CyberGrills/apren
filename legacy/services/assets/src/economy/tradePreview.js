const { pool } = require("../postgres");


async function previewTrade(data){


const buyer =
await pool.query(
`
SELECT balance
FROM wallets
WHERE user_id=$1
`,
[data.buyer_id]
);



const asset =
await pool.query(
`
SELECT current_value
FROM food_assets
WHERE id=$1
`,
[data.asset_id]
);



if(!asset.rows[0]){

throw new Error("Asset missing");

}


const cost =
Number(asset.rows[0].current_value)
*
Number(data.quantity);



return {

approved:
Number(buyer.rows[0]?.balance || 0)
>= cost,


cost,

buyer_balance:
Number(buyer.rows[0]?.balance || 0),


balance_after:
Number(buyer.rows[0]?.balance || 0)
-
cost

};


}


module.exports={
previewTrade
};

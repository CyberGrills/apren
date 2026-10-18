const { pool } = require("../postgres");

const wallet =
require("./walletTransfer");



async function executeTrade(data){

const client =
await pool.connect();


try{


await client.query("BEGIN");



const sellerHolding =
await client.query(
`
SELECT *
FROM food_asset_holdings
WHERE user_id=$1
AND asset_id=$2
FOR UPDATE
`,
[
data.seller_id,
data.asset_id
]
);



if(!sellerHolding.rows[0]){
throw new Error("Seller does not own asset");
}



if(
Number(sellerHolding.rows[0].quantity)
<
Number(data.quantity)
){
throw new Error("Insufficient asset quantity");
}



const asset =
await client.query(
`
SELECT *
FROM food_assets
WHERE id=$1
`,
[data.asset_id]
);



if(!asset.rows[0]){
throw new Error("Asset not found");
}



const price =
Number(asset.rows[0].current_value)
*
Number(data.quantity);



await wallet.transferMoney(
client,
data.buyer_id,
data.seller_id,
price
);



await client.query(
`
UPDATE food_asset_holdings
SET quantity = quantity - $1
WHERE user_id=$2
AND asset_id=$3
`,
[
data.quantity,
data.seller_id,
data.asset_id
]
);



await client.query(
`
INSERT INTO food_asset_holdings
(
user_id,
asset_id,
quantity,
average_price
)

VALUES
($1,$2,$3,$4)

ON CONFLICT(user_id,asset_id)

DO UPDATE SET

quantity =
food_asset_holdings.quantity
+
EXCLUDED.quantity

`,
[
data.buyer_id,
data.asset_id,
data.quantity,
asset.rows[0].current_value
]
);



const transaction =
await client.query(
`
INSERT INTO asset_transactions
(
asset_id,
seller_id,
buyer_id,
quantity,
price,
status
)

VALUES
($1,$2,$3,$4,$5,'COMPLETED')

RETURNING *
`,
[
data.asset_id,
data.seller_id,
data.buyer_id,
data.quantity,
price
]
);



await client.query(
`
INSERT INTO food_asset_events
(
asset_id,
event_type,
description
)

VALUES
($1,'TRADE_COMPLETED',
'Food asset ownership transferred')

`,
[
data.asset_id
]
);



await client.query("COMMIT");


return transaction.rows[0];


}
catch(error){

await client.query("ROLLBACK");

throw error;

}
finally{

client.release();

}

}


module.exports={
executeTrade
};

#!/bin/bash
set -e

echo "=== āprən Food Asset Market Settlement Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/market-settlement-v1

cp -r services/assets/src \
backups/market-settlement-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating transaction modules ==="

mkdir -p services/assets/src/transactions



cat > services/assets/src/transactions/walletTransfer.js <<'JS'
const { pool } = require("../postgres");


async function transferMoney(client, buyerId, sellerId, amount){

    const buyerWallet =
    await client.query(
    `
    SELECT *
    FROM wallets
    WHERE user_id=$1
    FOR UPDATE
    `,
    [buyerId]
    );


    if(!buyerWallet.rows[0]){
        throw new Error("Buyer wallet not found");
    }


    if(Number(buyerWallet.rows[0].balance) < Number(amount)){
        throw new Error("Insufficient wallet balance");
    }


    const sellerWallet =
    await client.query(
    `
    SELECT *
    FROM wallets
    WHERE user_id=$1
    FOR UPDATE
    `,
    [sellerId]
    );


    if(!sellerWallet.rows[0]){
        throw new Error("Seller wallet not found");
    }



    await client.query(
    `
    UPDATE wallets
    SET balance = balance - $1
    WHERE user_id=$2
    `,
    [
        amount,
        buyerId
    ]
    );


    await client.query(
    `
    UPDATE wallets
    SET balance = balance + $1
    WHERE user_id=$2
    `,
    [
        amount,
        sellerId
    ]
    );



    await client.query(
    `
    INSERT INTO wallet_transactions
    (
        wallet_id,
        type,
        amount,
        description
    )
    VALUES
    ($1,'PURCHASE',$2,'Food asset purchase'),
    ($3,'SALE',$2,'Food asset sale')
    `,
    [
        buyerWallet.rows[0].id,
        amount,
        sellerWallet.rows[0].id
    ]
    );


}


module.exports={
    transferMoney
};
JS




cat > services/assets/src/transactions/tradeEngine.js <<'JS'
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
JS




echo "=== Adding trade API route ==="


python3 <<'PY'
from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "tradeEngine" not in text:

    text=text.replace(
    'const foodTransactionEngine',
    'const tradeEngine = require("./transactions/tradeEngine");\n\nconst foodTransactionEngine'
    )



if "/economy/trade" not in text:

    route="""

app.post("/economy/trade", async(req,res)=>{

try{

const result =
await tradeEngine.executeTrade(req.body);


res.json({

success:true,

transaction:result

});

}

catch(error){

console.error(error);

res.status(500).json({

error:error.message

});

}

});


"""


    insert=text.find("app.listen")

    text=text[:insert]+route+text[insert:]


path.write_text(text)

PY



echo "=== Testing modules ==="

node - <<'NODE'
require("./services/assets/src/transactions/walletTransfer");
require("./services/assets/src/transactions/tradeEngine");

console.log("Market settlement engine loaded");
NODE



echo
echo "=== COMPLETE ==="
echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test POST /economy/trade"


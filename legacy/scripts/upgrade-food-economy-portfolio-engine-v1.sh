#!/bin/bash
set -e

echo "=== āprən Food Economy Portfolio Intelligence Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/portfolio-engine-v1

cp -r services/assets/src \
backups/portfolio-engine-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating portfolio modules ==="

mkdir -p services/assets/src/economy



cat > services/assets/src/economy/portfolioEngine.js <<'JS'
const { pool } = require("../postgres");


async function getPortfolio(userId){

const wallet =
await pool.query(
`
SELECT
balance,
currency
FROM wallets
WHERE user_id=$1
`,
[userId]
);


const assets =
await pool.query(
`
SELECT

fah.asset_id,

fa.asset_code,

fah.quantity,

fa.current_value,

(fah.quantity * fa.current_value)
AS market_value


FROM food_asset_holdings fah

JOIN food_assets fa

ON fa.id=fah.asset_id


WHERE fah.user_id=$1

ORDER BY market_value DESC

`,
[userId]
);



let totalValue = 0;


for(const asset of assets.rows){

totalValue += Number(asset.market_value);

}


return {

user_id:userId,

wallet:
wallet.rows[0] || null,

food_assets:
assets.rows,

food_asset_value:
totalValue,

economy_value:
totalValue +
Number(wallet.rows[0]?.balance || 0)

};


}


module.exports={
getPortfolio
};
JS



cat > services/assets/src/economy/fundingEngine.js <<'JS'
const { pool } = require("../postgres");


async function fundWallet(data){

const client =
await pool.connect();


try{

await client.query("BEGIN");


const wallet =
await client.query(
`
SELECT *
FROM wallets
WHERE user_id=$1
FOR UPDATE
`,
[data.user_id]
);


if(!wallet.rows[0]){

throw new Error("Wallet not found");

}



await client.query(
`
UPDATE wallets

SET balance =
balance + $1

WHERE user_id=$2

`,
[
data.amount,
data.user_id
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
(
$1,
'FUNDING',
$2,
'Wallet funding'
)

`,
[
wallet.rows[0].id,
data.amount
]
);



await client.query("COMMIT");


return {

success:true,

amount:data.amount

};


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
fundWallet
};
JS



cat > services/assets/src/economy/tradePreview.js <<'JS'
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
JS



echo "=== Adding economy routes ==="


python3 <<'PY'
from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "portfolioEngine" not in text:

    text=text.replace(
    'const tradeEngine',
    'const portfolioEngine = require("./economy/portfolioEngine");\nconst fundingEngine = require("./economy/fundingEngine");\nconst tradePreview = require("./economy/tradePreview");\n\nconst tradeEngine'
    )


routes="""

app.get("/portfolio/:userId", async(req,res)=>{

try{

const result =
await portfolioEngine.getPortfolio(
req.params.userId
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/wallet/fund", async(req,res)=>{

try{

const result =
await fundingEngine.fundWallet(req.body);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/economy/trade-preview", async(req,res)=>{

try{

const result =
await tradePreview.previewTrade(req.body);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


"""


if "/portfolio/:userId" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY



echo "=== Testing modules ==="

node - <<'NODE'

require("./services/assets/src/economy/portfolioEngine");
require("./services/assets/src/economy/fundingEngine");
require("./services/assets/src/economy/tradePreview");

console.log("Portfolio economy modules loaded");

NODE


echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test funding"
echo "4. test portfolio"


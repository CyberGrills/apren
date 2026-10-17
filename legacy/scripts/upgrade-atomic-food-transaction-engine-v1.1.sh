#!/bin/bash
set -e

echo "=== āprən Atomic Food Economy Transaction Engine v1.1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/atomic-engine-v1.1

cp -r services/assets/src \
backups/atomic-engine-v1.1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating transaction engine directory ==="

mkdir -p services/assets/src/transactions



cat > services/assets/src/transactions/foodTransactionEngine.js <<'JS'
const { pool } = require("../postgres");

const valuation =
require("../intelligence/valuation");


async function createFoodEconomyTransaction(data){

const client = await pool.connect();


try {


await client.query("BEGIN");



const value =
valuation.calculateValue({

basePrice:data.basePrice || 10,

freshness:data.freshness || 100,

demand:data.demand || 0,

trust:data.trust || 50,

scarcity:data.scarcity || 1

});



const assetResult =
await client.query(
`
INSERT INTO food_assets
(
asset_code,
current_value,
freshness_score,
demand_score,
trust_score,
market_status,
available_supply,
kitchen_price
)

VALUES
($1,$2,$3,$4,$5,'ACTIVE',$6,$7)

RETURNING *
`,
[
data.asset_code || `FOOD-${Date.now()}`,
value,
data.freshness || 100,
data.demand || 0,
data.trust || 50,
data.quantity || 0,
data.basePrice || value
]
);



const asset =
assetResult.rows[0];



if(data.owner_id){


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
data.owner_id,
asset.id,
data.quantity || 0,
value
]
);



await client.query(
`
INSERT INTO food_asset_ownership_history
(
asset_id,
owner_id,
action
)

VALUES
($1,$2,'CREATED')

`,
[
asset.id,
data.owner_id
]
);


}



await client.query(
`
INSERT INTO food_asset_events
(
asset_id,
event_type,
description
)

VALUES
($1,'CREATED',
'Atomic food transaction completed')

`,
[
asset.id
]
);



await client.query("COMMIT");


return asset;


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
createFoodEconomyTransaction
};
JS



echo "=== Creating wallet settlement foundation ==="


cat > services/assets/src/transactions/walletSettlement.js <<'JS'

async function settleWalletTransaction(){

return {

status:"READY",

message:
"Wallet settlement ledger prepared"

};

}


module.exports={
settleWalletTransaction
};

JS




echo "=== Creating transaction API bridge ==="


python3 <<'PY'

from pathlib import Path

path=Path(
"services/assets/src/server.js"
)

text=path.read_text()


if "foodTransactionEngine" not in text:

    text=text.replace(
        'const assetCreationService',
        'const foodTransactionEngine = require("./transactions/foodTransactionEngine");\n\nconst assetCreationService'
    )


route="""

app.post("/economy/create", async(req,res)=>{

try{

const asset =
await foodTransactionEngine.createFoodEconomyTransaction(
req.body
);


res.json({

success:true,

asset

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


if "/economy/create" not in text:

    insert=text.find('app.listen')

    text=text[:insert]+route+text[insert:]


path.write_text(text)

PY




echo "=== Testing transaction engine modules ==="


node - <<'NODE'

require("./services/assets/src/transactions/foodTransactionEngine");

require("./services/assets/src/transactions/walletSettlement");

console.log(
"Atomic food transaction engine loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check server.js"
echo "2. restart assets service"
echo "3. test /economy/create"


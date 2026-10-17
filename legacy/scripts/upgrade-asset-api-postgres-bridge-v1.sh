#!/bin/bash
set -e

echo "=== āprən Asset API PostgreSQL Bridge v1 ==="

cd ~/apren


echo "=== Backup assets server ==="

mkdir -p backups/assets-api-bridge

cp services/assets/src/server.js \
backups/assets-api-bridge/server.js.$(date +%Y%m%d_%H%M%S)


echo "=== Creating asset creation service ==="

mkdir -p services/assets/src/services


cat > services/assets/src/services/assetCreationService.js <<'JS'
const repository = require("../repositories/assetRepository");
const valuation = require("../intelligence/valuation");
const postgres = require("../postgres");


async function createFoodAsset(data){

    const calculatedValue = valuation.calculateValue({

        basePrice: data.basePrice || 10,
        freshness: data.freshness || 100,
        demand: data.demand || 0,
        trust: data.trust || 50,
        scarcity: data.scarcity || 1

    });


    const asset = await repository.createAsset({

        food_id: data.food_id || null,

        asset_code:
            data.asset_code ||
            `FOOD-${Date.now()}`,

        current_value: calculatedValue,

        freshness_score:
            data.freshness || 100,

        demand_score:
            data.demand || 0,

        trust_score:
            data.trust || 50,

        available_supply:
            data.quantity || 0,

        kitchen_price:
            data.basePrice || calculatedValue

    });


    if(data.owner_id){

        await postgres.query(
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
        food_asset_holdings.quantity + EXCLUDED.quantity
        `,
        [
            data.owner_id,
            asset.id,
            data.quantity || 0,
            calculatedValue
        ]
        );


        await postgres.query(
        `
        INSERT INTO food_asset_ownership_history
        (
            asset_id,
            owner_id,
            action
        )
        VALUES
        ($1,$2,$3)
        `,
        [
            asset.id,
            data.owner_id,
            "ASSET_CREATED"
        ]
        );

    }


    await postgres.query(
    `
    INSERT INTO food_asset_events
    (
        asset_id,
        event_type,
        description
    )
    VALUES
    ($1,$2,$3)
    `,
    [
        asset.id,
        "CREATED",
        "Food asset created through PostgreSQL asset engine"
    ]
    );


    return asset;

}


module.exports = {
    createFoodAsset
};
JS



echo "=== Updating server route ==="


python3 <<'PY'

from pathlib import Path

path = Path(
"services/assets/src/server.js"
)

text = path.read_text()


if "assetCreationService" not in text:

    marker = "const express"

    text = text.replace(
        marker,
        'const assetCreationService = require("./services/assetCreationService");\n\n' + marker
    )


start = text.find('app.post("/assets",(req,res)=>{')

if start == -1:
    raise Exception("POST /assets route not found")


end = text.find('\n});', start)

if end == -1:
    raise Exception("Route ending not found")


end = end + len('\n});')


new_route = r'''
app.post("/assets", async(req,res)=>{

try {

const asset =
await assetCreationService.createFoodAsset(
req.body
);


res.json({

created:true,

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
'''


text = text[:start] + new_route + text[end:]


path.write_text(text)

PY



echo "=== Testing modules ==="


node - <<'NODE'
require("./services/assets/src/postgres");
require("./services/assets/src/services/assetCreationService");
console.log("Asset PostgreSQL bridge loaded");
NODE


echo
echo "=== COMPLETE ==="
echo "Next:"
echo "1. Restart assets service"
echo "2. Test POST /assets"
echo "3. Verify PostgreSQL records"


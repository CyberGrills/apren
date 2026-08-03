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

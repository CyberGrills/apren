function createAssetProfile(asset, passport, ownership, verification, freshness, lifecycle){

    return {

        assetIdentity:{
            id:asset.id,
            name:asset.name,
            category:asset.category,
            origin:asset.kitchen
        },

        value:{
            amount:asset.base_value,
            currency:asset.currency
        },

        ownership:{
            owner:ownership.owner,
            quantity:ownership.quantity,
            status:ownership.status
        },

        trust:{
            verified:
                verification.records.length > 0,

            evidence:
                verification.records
        },


        freshness:{
            score:freshness.result.freshness,
            state:freshness.result.state,
            remainingHours:freshness.result.remainingHours
        },


        lifecycle:{
            events:lifecycle.events
        },


        tradingReady:
            freshness.result.freshness > 50 &&
            verification.records.length > 0

    };

}


module.exports=createAssetProfile;

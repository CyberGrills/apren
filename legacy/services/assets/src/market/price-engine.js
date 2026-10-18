function calculateMarketValue(asset, freshness){

    const freshnessFactor =
        freshness.freshnessScore / 100;


    let demandFactor = 1;


    if(asset.demand === "High"){

        demandFactor = 1.15;

    }
    else if(asset.demand === "Increasing"){

        demandFactor = 1.10;

    }
    else if(asset.demand === "Low"){

        demandFactor = 0.85;

    }


    let availabilityFactor = 1;


    if(asset.status !== "available"){

        availabilityFactor = 0.9;

    }


    const marketValue =
        Number(
            (
                asset.base_value *
                freshnessFactor *
                demandFactor *
                availabilityFactor
            ).toFixed(2)
        );


    return {

        baseValue:
            asset.base_value,

        marketValue,

        currency:
            asset.currency,


        signals:{

            freshness:
                freshness.freshnessScore,

            demand:
                asset.demand,

            availability:
                asset.status

        }

    };

}


module.exports = calculateMarketValue;

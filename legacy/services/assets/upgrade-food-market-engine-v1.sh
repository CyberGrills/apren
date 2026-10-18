#!/bin/bash

set -e

echo "Installing āprən Food Market Engine v1..."

mkdir -p src/market


cat > src/market/price-engine.js <<'JS'
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
JS



python3 - <<'PY'
from pathlib import Path


p=Path("src/server.js")

s=p.read_text()


if 'price-engine' not in s:

    s=s.replace(
    'const adjustValue = require("./intelligence/value-adjustment");',
    '''const adjustValue = require("./intelligence/value-adjustment");
const calculateMarketValue = require("./market/price-engine");'''
    )



route=r'''

app.get("/assets/:id/market-value",(req,res)=>{

try{


const asset =
db.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(req.params.id);



if(!asset){

return res.status(404).json({

error:"Asset not found"

});

}



const freshness =
analyzeFreshness({

category:asset.category,

imageConfidence:
asset.freshness_score

});



const market =
calculateMarketValue(
asset,
freshness
);



res.json({

system:"apren-food-market-engine",

asset:asset.name,

market

});


}catch(error){

res.status(500).json({

error:error.message

});

}


});

'''



if '/market-value' not in s:

    s=s.replace(
        'app.listen(4003,()=>{',
        route + '\napp.listen(4003,()=>{'
    )


p.write_text(s)

print("Market engine installed")

PY



node -c src/server.js


echo ""
echo "Market Engine ready."
echo "Restart:"
echo "npm start"


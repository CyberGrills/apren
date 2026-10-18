#!/bin/bash

set -e

echo "Installing āprən Food Intelligence Engine v1..."

mkdir -p src/intelligence


cat > src/intelligence/food-vision.js <<'JS'
function detectFood(asset){

    const category =
        asset.category ||
        "unknown";


    const perishability =
        [
            "Prepared meals",
            "Produce",
            "Meat",
            "Dairy",
            "Seafood"
        ].includes(category)
        ? "perishable"
        : "non-perishable";


    return {

        detectedProduct: asset.name,

        category,

        perishability,

        confidence:95

    };

}


module.exports = detectFood;
JS



cat > src/intelligence/freshness-decay.js <<'JS'
function calculateDecay(asset){

    const now = Date.now();


    let hours = 0;


    if(asset.created_at){

        hours =
        (now - new Date(asset.created_at).getTime())
        /
        (1000*60*60);

    }


    let freshness;


    if(
        asset.category === "Prepared meals" ||
        asset.category === "Produce"
    ){

        freshness =
            Math.max(
                0,
                100 - (hours / 24 * 100)
            );

    }
    else {

        freshness = 100;

    }


    return {

        freshnessScore:
            Math.round(freshness),

        hoursSinceCreation:
            Math.round(hours),

        lifecycle:
            freshness <= 0
            ? "EXPIRED"
            : "FRESH"

    };

}


module.exports = calculateDecay;
JS



cat > src/intelligence/value-adjustment.js <<'JS'
function adjustValue(asset,freshness){

    const multiplier =
        freshness.freshnessScore / 100;


    return {

        originalValue:
            asset.base_value,


        currentValue:
            Number(
              (
              asset.base_value *
              multiplier
              ).toFixed(2)
            ),


        currency:
            asset.currency


    };

}


module.exports = adjustValue;
JS



python3 - <<'PY'
from pathlib import Path

p=Path("src/server.js")

s=p.read_text()


if 'food-vision' not in s:

    s=s.replace(
    'const analyzeFreshness = require("./intelligence/freshness");',
    '''const analyzeFreshness = require("./intelligence/freshness");
const detectFood = require("./intelligence/food-vision");
const calculateDecayIntelligence = require("./intelligence/freshness-decay");
const adjustValue = require("./intelligence/value-adjustment");'''
    )


route=r'''

app.post("/assets/:id/analyze-food",(req,res)=>{

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



const vision =
detectFood(asset);



const decay =
calculateDecayIntelligence(asset);



const valuation =
adjustValue(asset,decay);



db.prepare(`
UPDATE food_assets

SET freshness_score=?

WHERE id=?

`)
.run(
decay.freshnessScore,
req.params.id
);



res.json({

system:"apren-food-intelligence",

asset,

vision,

freshness:decay,

valuation

});


}catch(error){

res.status(500).json({
error:error.message
});

}


});

'''


if '/analyze-food' not in s:

    s=s.replace(
        'app.listen(4003,()=>{',
        route + '\napp.listen(4003,()=>{'
    )


p.write_text(s)

print("Food Intelligence Engine installed")

PY



node -c src/server.js

echo ""
echo "Upgrade complete."
echo "Restart:"
echo "npm start"


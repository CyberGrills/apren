#!/bin/bash

set -e

echo "🚀 Installing āprən Food Asset Ownership Engine..."

mkdir -p src/ownership


echo "🗄 Creating ownership database..."


cat > src/ownership/ownership-db.js <<'JS'
const db = require("../db");


db.exec(`

CREATE TABLE IF NOT EXISTS food_asset_holdings (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    asset_id INTEGER NOT NULL,

    owner_id INTEGER NOT NULL,

    quantity REAL DEFAULT 1,

    ownership_type TEXT DEFAULT 'CREATED',

    acquired_at TEXT DEFAULT CURRENT_TIMESTAMP

);

`);




const existing = db
.prepare(
"SELECT COUNT(*) count FROM food_asset_holdings"
)
.get();



if(existing.count === 0){

const assets = db
.prepare(
"SELECT id,owner_id FROM food_assets"
)
.all();



const insert = db.prepare(`

INSERT INTO food_asset_holdings

(
asset_id,
owner_id,
quantity,
ownership_type
)

VALUES
(?,?,?,?)

`);




for(const asset of assets){

insert.run(
asset.id,
asset.owner_id,
1,
"CREATED"
);

}

}



module.exports = db;
JS




echo "🔄 Adding ownership API..."


python3 - <<'PY'

from pathlib import Path

p=Path("src/server.js")

s=p.read_text()


if 'require("./ownership/ownership-db")' not in s:

    s=s.replace(
    'require("./passport/passport-db");',
    'require("./passport/passport-db");\nrequire("./ownership/ownership-db");'
    )



route='''


app.get("/ownership/:assetId",(req,res)=>{


const holding = db.prepare(`

SELECT

h.asset_id,
h.owner_id,
h.quantity,
h.ownership_type,
h.acquired_at,
a.name AS asset

FROM food_asset_holdings h

JOIN food_assets a

ON a.id=h.asset_id

WHERE h.asset_id=?

`).get(req.params.assetId);



if(!holding){

return res.status(404).json({

error:"Ownership record not found"

});

}



res.json({

system:"apren-food-ownership",

ownership:{

asset:holding.asset,

assetId:holding.asset_id,

owner:holding.owner_id,

quantity:holding.quantity,

status:"owned",

ownershipType:holding.ownership_type,

acquiredAt:holding.acquired_at

}

});


});



'''



if '/ownership/:assetId' not in s:

    s=s.replace(
    'app.listen(4003,()=>{',
    route+'\napp.listen(4003,()=>{'
    )


p.write_text(s)

PY



echo "🧪 Testing ownership database..."

node -e "

require('./src/ownership/ownership-db');

const db=require('./src/db');

console.log(
db.prepare('SELECT COUNT(*) count FROM food_asset_holdings').get()
);

"



echo ""
echo "✅ Ownership Engine installed"
echo ""
echo "Restart service:"
echo "npm start"


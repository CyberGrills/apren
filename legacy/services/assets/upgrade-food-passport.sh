#!/bin/bash

set -e

echo "🚀 Building āprən Food Passport Engine..."

mkdir -p src/passport


echo "🗄 Adding passport database table..."

cat > src/passport/passport-db.js <<'JS'
const db = require("../db");


db.exec(`

CREATE TABLE IF NOT EXISTS passport_events (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    asset_id INTEGER NOT NULL,

    event_type TEXT NOT NULL,

    description TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP

);

`);



const existing = db
.prepare(
"SELECT COUNT(*) count FROM passport_events"
)
.get();



if(existing.count === 0){

const assets = db
.prepare(
"SELECT id,name,kitchen FROM food_assets"
)
.all();



const insert = db.prepare(`

INSERT INTO passport_events
(
asset_id,
event_type,
description
)

VALUES
(?,?,?)

`);



for(const asset of assets){

insert.run(
asset.id,
"CREATED",
`Food asset ${asset.name} created from ${asset.kitchen}`
);

}

}


module.exports = db;
JS



echo "🔄 Updating API with passport routes..."


python3 - <<'PY'

from pathlib import Path

p=Path("src/server.js")

s=p.read_text()


if 'require("./passport/passport-db")' not in s:

    s=s.replace(
    'const analyzeFreshness = require("./intelligence/freshness");',
    'const analyzeFreshness = require("./intelligence/freshness");\nrequire("./passport/passport-db");'
    )


route='''


app.get("/passport/:assetId",(req,res)=>{


const asset = db.prepare(

"SELECT * FROM food_assets WHERE id=?"

).get(req.params.assetId);



if(!asset){

return res.status(404).json({

error:"Asset not found"

});

}



const history = db.prepare(

"SELECT * FROM passport_events WHERE asset_id=? ORDER BY id ASC"

).all(req.params.assetId);



res.json({

system:"apren-food-passport",

passport:{

assetId:asset.id,

food:asset.name,

origin:asset.kitchen,

category:asset.category,

owner:asset.owner_id,

value:asset.base_value,

currency:asset.currency,

freshness:asset.freshness_score,

demand:asset.demand,

status:asset.status,

history

}

});


});

'''


if '/passport/:assetId' not in s:

    s=s.replace(
    'app.listen(4003,()=>{',
    route+'\napp.listen(4003,()=>{'
    )


p.write_text(s)

PY


echo "🧪 Testing passport database..."

node -e "

require('./src/passport/passport-db');

const db=require('./src/db');

console.log(
db.prepare('SELECT COUNT(*) count FROM passport_events').get()
);

"


echo ""
echo "✅ Food Passport Engine installed"
echo ""
echo "Restart service:"
echo "npm start"


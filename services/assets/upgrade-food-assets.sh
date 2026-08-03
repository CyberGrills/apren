#!/bin/bash

set -e

echo "🚀 Upgrading āprən Food Asset Engine to database mode..."

mkdir -p src/database
mkdir -p src/intelligence


echo "📦 Installing database dependency..."

npm install better-sqlite3


echo "🗄 Creating database layer..."

cat > src/db.js <<'JS'
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(
    __dirname,
    "database",
    "food_assets.sqlite"
);

const db = new Database(dbPath);


db.exec(`
CREATE TABLE IF NOT EXISTS food_assets (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    owner_id INTEGER NOT NULL,

    name TEXT NOT NULL,

    kitchen TEXT,

    category TEXT,

    base_value REAL,

    currency TEXT,

    freshness_score REAL,

    expiry_time TEXT,

    demand TEXT,

    status TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP

);
`);


const count = db
.prepare("SELECT COUNT(*) as count FROM food_assets")
.get();


if(count.count === 0){

const insert = db.prepare(`

INSERT INTO food_assets
(
owner_id,
name,
kitchen,
category,
base_value,
currency,
freshness_score,
demand,
status
)

VALUES
(?,?,?,?,?,?,?,?,?)

`);


insert.run(
1,
"Chicken Rice Bowl",
"Kitchen A",
"Prepared meals",
15,
"ə",
92,
"Increasing",
"available"
);


insert.run(
1,
"Heirloom Tomatoes",
"Green Acre Farm",
"Produce",
6,
"ə",
97,
"High",
"available"
);


insert.run(
1,
"Jasmine Rice 5kg",
"Mekong Supply Co.",
"Grains",
11,
"ə",
88,
"Steady",
"available"
);

}


module.exports = db;
JS



echo "🔄 Updating server..."


cat > src/server.js <<'JS'
const express = require("express");
const cors = require("cors");

const db = require("./db");
const analyzeFreshness = require("./intelligence/freshness");


const app = express();


app.use(cors());
app.use(express.json());



app.get("/assets",(req,res)=>{


const assets = db
.prepare(
"SELECT * FROM food_assets"
)
.all();


res.json({

system:"apren-food-asset-engine",

assets

});


});




app.get("/assets/:id",(req,res)=>{


const asset = db
.prepare(
"SELECT * FROM food_assets WHERE id=?"
)
.get(req.params.id);



if(!asset){

return res.status(404).json({

error:"Asset not found"

});

}



const freshness = analyzeFreshness({

category:asset.category,

imageConfidence:asset.freshness_score

});



res.json({

...asset,

freshness

});


});




app.get("/assets/user/:userId",(req,res)=>{


const assets = db
.prepare(
"SELECT * FROM food_assets WHERE owner_id=?"
)
.all(req.params.userId);



res.json({

owner:req.params.userId,

assets

});


});





app.post("/assets",(req,res)=>{


const {

owner_id,
name,
kitchen,
category,
base_value,
currency="ə"

}=req.body;



const result = db.prepare(`

INSERT INTO food_assets

(
owner_id,
name,
kitchen,
category,
base_value,
currency,
freshness_score,
demand,
status
)

VALUES
(?,?,?,?,?,?,?,?,?)

`).run(

owner_id,
name,
kitchen,
category,
base_value,
currency,
90,
"New",
"available"

);



res.json({

created:true,

id:result.lastInsertRowid

});


});





app.listen(4003,()=>{

console.log(
"āprən Food Asset Engine running on 4003"
);

});
JS



echo "🧪 Testing database..."

node -e "

const db=require('./src/db');

console.log(
db.prepare('SELECT COUNT(*) count FROM food_assets').get()
);

"


echo ""
echo "✅ Food Asset Database upgrade complete"
echo ""
echo "Start service:"
echo "npm start"


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

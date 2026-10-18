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

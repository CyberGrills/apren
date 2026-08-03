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








db.exec(`

CREATE TABLE IF NOT EXISTS asset_evidence (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    asset_id INTEGER NOT NULL,

    type TEXT,

    file TEXT,

    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,

    analysis_status TEXT DEFAULT 'PENDING',

    freshness_score REAL,

    confidence REAL

);

`);



db.exec(`

CREATE TABLE IF NOT EXISTS market_signals (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    asset_id INTEGER NOT NULL,

    demand_multiplier REAL DEFAULT 1,

    freshness_multiplier REAL DEFAULT 1,

    scarcity_multiplier REAL DEFAULT 1,

    location_multiplier REAL DEFAULT 1,

    seasonal_multiplier REAL DEFAULT 1,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP

);


CREATE TABLE IF NOT EXISTS user_preferences (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER UNIQUE NOT NULL,

    preferred_currency TEXT DEFAULT 'EUR',

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP

);

`);


const signalCount =
db.prepare(
"SELECT COUNT(*) count FROM market_signals"
).get();


if(signalCount.count === 0){

const assets =
db.prepare(
"SELECT id FROM food_assets"
).all();


const insert =
db.prepare(`

INSERT INTO market_signals
(
asset_id,
demand_multiplier,
freshness_multiplier,
scarcity_multiplier,
location_multiplier,
seasonal_multiplier
)

VALUES
(?,?,?,?,?,?)

`);


for(const asset of assets){

insert.run(
asset.id,
1.08,
0.95,
1,
1,
1
);

}

}


const userCount =
db.prepare(
"SELECT COUNT(*) count FROM user_preferences"
).get();


if(userCount.count === 0){

db.prepare(`

INSERT INTO user_preferences
(
user_id,
preferred_currency
)

VALUES
(1,'EUR')

`).run();

}



module.exports = db;

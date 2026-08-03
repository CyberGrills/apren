const db = require("../db");

db.exec(`

CREATE TABLE IF NOT EXISTS food_evidence (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    asset_id INTEGER NOT NULL,

    type TEXT NOT NULL,

    file TEXT NOT NULL,

    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,

    analysis_status TEXT DEFAULT 'PENDING',

    freshness_score REAL,

    confidence REAL

);

`);

module.exports = db;

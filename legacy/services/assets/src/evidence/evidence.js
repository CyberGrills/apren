const db = require("./evidence-db");


function addEvidence(assetId,type,file){

const result=db.prepare(`

INSERT INTO food_evidence
(
asset_id,
type,
file
)

VALUES
(?,?,?)

`).run(
assetId,
type,
file
);


return {
id:result.lastInsertRowid,
assetId,
type,
file,
status:"PENDING"
};

}



function analyzeEvidence(id){

const evidence=db.prepare(
"SELECT * FROM food_evidence WHERE id=?"
)
.get(id);


if(!evidence)
return null;


const freshness =
Math.floor(
80 + Math.random()*20
);


const confidence =
Math.floor(
85 + Math.random()*15
);



db.prepare(`

UPDATE food_evidence

SET
analysis_status='COMPLETED',
freshness_score=?,
confidence=?

WHERE id=?

`).run(
freshness,
confidence,
id
);



return {

assetId:evidence.asset_id,

freshness,

confidence,

estimatedExpiry:
new Date(
Date.now()+24*60*60*1000
).toISOString()

};

}


module.exports={
addEvidence,
analyzeEvidence
};

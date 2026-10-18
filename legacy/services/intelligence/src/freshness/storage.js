
const records=[];


function saveEvidence(data){

const item={
id:records.length+1,
uploaded_at:new Date().toISOString(),
...data
};


records.push(item);

return item;

}


function getEvidence(assetId){

return records.filter(
r=>r.asset_id===Number(assetId)
);

}


module.exports={
saveEvidence,
getEvidence
};


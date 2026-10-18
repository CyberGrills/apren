#!/bin/bash

set -e

echo "Updating āprən Food Asset Lifecycle Engine..."

mkdir -p src/lifecycle


cat > src/lifecycle/lifecycle.js <<'JS'
const events = {};

function createEvent(assetId,type,description){

    if(!events[assetId]){
        events[assetId]=[];
    }

    const event={
        id: events[assetId].length+1,
        asset_id:Number(assetId),
        event_type:type,
        description,
        created_at:new Date().toISOString()
    };

    events[assetId].push(event);

    return event;
}


function getEvents(assetId){

    return events[assetId] || [];

}


module.exports={
    createEvent,
    getEvents
};
JS


python3 - <<'PY'
from pathlib import Path

p=Path("src/server.js")

s=p.read_text()


if 'require("./lifecycle/lifecycle")' not in s:
    s=s.replace(
        'const analyzeFreshness = require("./intelligence/freshness");',
        'const analyzeFreshness = require("./intelligence/freshness");\nconst lifecycle = require("./lifecycle/lifecycle");'
    )


if '/lifecycle/' not in s:

    insert='''


app.post("/lifecycle/:id/event",(req,res)=>{

 const event=lifecycle.createEvent(
    req.params.id,
    req.body.type,
    req.body.description
 );

 res.json({
    system:"apren-food-lifecycle",
    event
 });

});



app.get("/lifecycle/:id",(req,res)=>{

 res.json({
    system:"apren-food-lifecycle",
    assetId:req.params.id,
    events:lifecycle.getEvents(req.params.id)
 });

});


'''

    s=s.replace(
        'app.listen(4003,()=>{',
        insert+'app.listen(4003,()=>{'
    )


p.write_text(s)

print("Lifecycle routes added")
PY


npm install

echo ""
echo "================================="
echo "Lifecycle Engine Installed"
echo "Restart assets service:"
echo "npm start"
echo "================================="

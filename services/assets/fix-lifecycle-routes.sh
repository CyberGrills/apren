#!/bin/bash

set -e

echo "Adding āprən lifecycle routes..."

python3 - <<'PY'
from pathlib import Path

p=Path("src/server.js")

s=p.read_text()

routes=r'''

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

if 'app.post("/lifecycle/:id/event"' not in s:
    s=s.replace(
        'app.listen(4003,()=>{',
        routes + '\napp.listen(4003,()=>{'
    )

p.write_text(s)

print("Lifecycle routes installed")
PY


echo "Restarting service..."

pkill -f "node src/server.js" || true

sleep 2

npm start

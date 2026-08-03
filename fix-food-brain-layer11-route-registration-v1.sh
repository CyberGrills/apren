#!/bin/bash
set -e

echo "=== Fix Layer 11 Autonomous Decision Route Registration ==="

cd ~/apren

mkdir -p backups/layer11-route-fix

cp services/assets/src/server.js \
backups/layer11-route-fix/server.js-$(date +%Y%m%d_%H%M%S)


python3 <<'PY'
from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if 'require("./decision/autonomousDecisionEngine")' not in text:

    anchor='const predictiveSimulationEngine = require("./predictive/predictiveSimulationEngine");'

    if anchor in text:

        text=text.replace(
            anchor,
            anchor + '\nconst autonomousDecisionEngine = require("./decision/autonomousDecisionEngine");'
        )

    else:

        text=text.replace(
            'const memoryFusionEngine',
            'const autonomousDecisionEngine = require("./decision/autonomousDecisionEngine");\n\nconst memoryFusionEngine'
        )



if '/brain/decision/' not in text:

    route="""

app.post("/brain/decision/:assetId", async(req,res)=>{

try{

res.json(
await autonomousDecisionEngine.decide(
req.params.assetId,
req.body.simulations
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



"""

    insert=text.find("app.listen")

    text=text[:insert]+route+text[insert:]



path.write_text(text)

PY


node --check services/assets/src/server.js


echo "=== Verify ==="

grep -n "autonomousDecisionEngine" services/assets/src/server.js

grep -n "brain/decision" services/assets/src/server.js


echo "=== COMPLETE ==="


#!/bin/bash
set -e

echo "=== āprən Food Brain Trust Calibration Layer 13.1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer13-1-trust-calibration

cp services/assets/src/governance/approvalPolicyEngine.js \
backups/layer13-1-trust-calibration/approvalPolicyEngine.js-$(date +%Y%m%d_%H%M%S)



echo "=== Updating approval policy ==="


cat > services/assets/src/governance/approvalPolicyEngine.js <<'JS'
function approve(risk,permission){


if(risk==="LOW" && permission==="AUTONOMOUS"){

return {

approved:true,

mode:"AUTONOMOUS",

requires_confirmation:false

};

}



if(risk==="LOW" && permission==="ASSISTED"){

return {

approved:false,

mode:"ASSISTED",

requires_confirmation:true

};

}



if(risk==="MEDIUM"){

return {

approved:false,

mode:"ASSISTED",

requires_confirmation:true

};

}



return {

approved:false,

mode:"PROTECTED",

requires_confirmation:false

};

}



module.exports={
approve
};
JS




echo "=== Adding permission control route ==="


cat > services/assets/src/routes/brainPermissionRoutes.js <<'JS'
const express=require("express");

const router=express.Router();


const permission =
require("../governance/permissionMemoryEngine");



router.post("/permission/:userId",async(req,res)=>{

try{

const result =
permission.setPermission(
req.params.userId,
req.body.mode
);


res.json({

user_id:req.params.userId,

permission:result

});

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



router.get("/permission/:userId",async(req,res)=>{


res.json({

user_id:req.params.userId,

permission:
permission.getPermission(
req.params.userId
)

});


});


module.exports=router;
JS




echo "=== Register permission routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainPermissionRoutes" not in text:

    text=text.replace(
    'const brainGovernanceRoutes = require("./routes/brainGovernanceRoutes");',
    '''const brainGovernanceRoutes = require("./routes/brainGovernanceRoutes");

const brainPermissionRoutes = require("./routes/brainPermissionRoutes");'''
    )



if 'app.use("/brain", brainPermissionRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainGovernanceRoutes);',
    '''app.use("/brain", brainGovernanceRoutes);

app.use("/brain", brainPermissionRoutes);'''
    )


p.write_text(text)

PY




echo "=== Testing ==="


node - <<'NODE'

const policy =
require("./services/assets/src/governance/approvalPolicyEngine");


console.log(
policy.approve("LOW","ASSISTED")
);


console.log(
policy.approve("LOW","AUTONOMOUS")
);


console.log(
policy.approve("HIGH","AUTONOMOUS")
);


NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 13.1 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test calibration"
echo "3. commit + tag"


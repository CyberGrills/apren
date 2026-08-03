
function check(data){

if(data.executionMode==="AUTONOMOUS"){

return {
allowed:true,
mode:"AUTONOMOUS"
};

}


return {
allowed:true,
mode:"ASSISTED"
};

}


module.exports={
check
};


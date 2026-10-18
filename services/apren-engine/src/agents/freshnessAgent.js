
function analyze(data){

if(data.freshness < 15){

return {
agent:"freshness",
signal:"CRITICAL",
recommendation:"MOVE_FAST",
confidence:95
};

}

if(data.freshness < 30){

return {
agent:"freshness",
signal:"WARNING",
recommendation:"MONITOR",
confidence:75
};

}


return {
agent:"freshness",
signal:"STABLE",
recommendation:"HOLD",
confidence:60
};

}


module.exports={analyze};


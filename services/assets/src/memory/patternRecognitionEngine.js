
function analyze(memories){


let success=0;


for(const memory of memories){

if(memory.outcome){

success++;

}

}


return {

patterns_found:memories.length,

experience_score:
memories.length
?
Math.round(
(success/memories.length)*100
)
:0

};

}


module.exports={
analyze
};


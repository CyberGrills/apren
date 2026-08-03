
function pipeline(data){

return {

prediction:{
status:"COMPLETE"
},

collective:{
status:"COMPLETE"
},

simulation:{
status:"COMPLETE"
},

decision:{
status:"READY"
},

execution:{
status:"READY"
}

};

}


module.exports={
pipeline
};


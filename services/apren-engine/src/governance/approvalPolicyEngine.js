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

const permissions={};


function setPermission(userId,mode){

permissions[userId]=mode;

return permissions[userId];

}



function getPermission(userId){

return permissions[userId] || "ASSISTED";

}


module.exports={
setPermission,
getPermission
};

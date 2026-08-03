function validate(action){

const blocked=[
"DELETE",
"REMOVE_USER"
];


if(
blocked.includes(action)
){

return {

allowed:false,

reason:"Unsafe action blocked"

};

}



return {

allowed:true,

reason:"Action approved"

};

}



module.exports={
validate
};

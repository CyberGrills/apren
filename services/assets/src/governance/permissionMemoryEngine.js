const {pool}=require("../postgres");



async function setPermission(userId,mode){


const result =
await pool.query(
`
INSERT INTO food_brain_user_preferences
(
user_id,
autonomy_mode,
updated_at
)

VALUES
($1,$2,CURRENT_TIMESTAMP)

ON CONFLICT(user_id)

DO UPDATE SET

autonomy_mode=$2,

updated_at=CURRENT_TIMESTAMP

RETURNING *
`,
[
userId,
mode
]
);


return result.rows[0];

}





async function getPermission(userId){


const result =
await pool.query(
`
SELECT autonomy_mode

FROM food_brain_user_preferences

WHERE user_id=$1
`,
[
userId
]
);



if(!result.rows.length){

return "ASSISTED";

}


return result.rows[0].autonomy_mode;


}



module.exports={

setPermission,

getPermission

};

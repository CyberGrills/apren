const { pool } = require("../postgres");


async function fundWallet(data){

const client =
await pool.connect();


try{

await client.query("BEGIN");


const wallet =
await client.query(
`
SELECT *
FROM wallets
WHERE user_id=$1
FOR UPDATE
`,
[data.user_id]
);


if(!wallet.rows[0]){

throw new Error("Wallet not found");

}



await client.query(
`
UPDATE wallets

SET balance =
balance + $1

WHERE user_id=$2

`,
[
data.amount,
data.user_id
]
);



await client.query(
`
INSERT INTO wallet_transactions
(
wallet_id,
type,
amount,
description
)

VALUES
(
$1,
'FUNDING',
$2,
'Wallet funding'
)

`,
[
wallet.rows[0].id,
data.amount
]
);



await client.query("COMMIT");


return {

success:true,

amount:data.amount

};


}

catch(error){

await client.query("ROLLBACK");

throw error;

}

finally{

client.release();

}


}


module.exports={
fundWallet
};

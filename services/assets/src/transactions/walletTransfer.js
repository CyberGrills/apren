const { pool } = require("../postgres");


async function transferMoney(client, buyerId, sellerId, amount){

    const buyerWallet =
    await client.query(
    `
    SELECT *
    FROM wallets
    WHERE user_id=$1
    FOR UPDATE
    `,
    [buyerId]
    );


    if(!buyerWallet.rows[0]){
        throw new Error("Buyer wallet not found");
    }


    if(Number(buyerWallet.rows[0].balance) < Number(amount)){
        throw new Error("Insufficient wallet balance");
    }


    const sellerWallet =
    await client.query(
    `
    SELECT *
    FROM wallets
    WHERE user_id=$1
    FOR UPDATE
    `,
    [sellerId]
    );


    if(!sellerWallet.rows[0]){
        throw new Error("Seller wallet not found");
    }



    await client.query(
    `
    UPDATE wallets
    SET balance = balance - $1
    WHERE user_id=$2
    `,
    [
        amount,
        buyerId
    ]
    );


    await client.query(
    `
    UPDATE wallets
    SET balance = balance + $1
    WHERE user_id=$2
    `,
    [
        amount,
        sellerId
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
    ($1,'PURCHASE',$2,'Food asset purchase'),
    ($3,'SALE',$2,'Food asset sale')
    `,
    [
        buyerWallet.rows[0].id,
        amount,
        sellerWallet.rows[0].id
    ]
    );


}


module.exports={
    transferMoney
};

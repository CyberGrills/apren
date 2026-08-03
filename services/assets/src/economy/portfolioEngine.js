const { pool } = require("../postgres");


async function getPortfolio(userId){

const wallet =
await pool.query(
`
SELECT
balance,
currency
FROM wallets
WHERE user_id=$1
`,
[userId]
);


const assets =
await pool.query(
`
SELECT

fah.asset_id,

fa.asset_code,

fah.quantity,

fa.current_value,

(fah.quantity * fa.current_value)
AS market_value


FROM food_asset_holdings fah

JOIN food_assets fa

ON fa.id=fah.asset_id


WHERE fah.user_id=$1

ORDER BY market_value DESC

`,
[userId]
);



let totalValue = 0;


for(const asset of assets.rows){

totalValue += Number(asset.market_value);

}


return {

user_id:userId,

wallet:
wallet.rows[0] || null,

food_assets:
assets.rows,

food_asset_value:
totalValue,

economy_value:
totalValue +
Number(wallet.rows[0]?.balance || 0)

};


}


module.exports={
getPortfolio
};


export function mapWallet(wallet){

const wallets =
wallet?.wallets || [];


return {

cash:
wallets.find(
w=>w.currency!=="ə"
),

food:
wallets.find(
w=>w.currency==="ə"
)

};

}




export function getCashWallet(wallet){

return wallet?.wallets?.find(
w=>w.currency!=="ə"
);

}


export function getSchwaWallet(wallet){

return wallet?.wallets?.find(
w=>w.currency==="ə"
);

}



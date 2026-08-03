const WALLET_URL = "http://localhost:4002";

export async function getWallet(userId = 1){

  try{

    const res = await fetch(
      `${WALLET_URL}/wallet/${userId}`
    );

    if(!res.ok){
      throw new Error("Wallet request failed");
    }

    return await res.json();

  }catch(error){

    console.error(
      "Wallet service unavailable:",
      error
    );

    return {
      wallets:[
        {
          wallet_type:"schwa",
          balance:42
        }
      ]
    };

  }

}

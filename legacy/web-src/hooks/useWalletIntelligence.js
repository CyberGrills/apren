
import {useEffect,useState} from "react";

import {getWallet} from "../services/api/walletApi";
import {getUserPreferences} from "../services/api/userPreferenceApi";
import {mapWallet} from "../services/mappers/walletMapper";


export function useWalletIntelligence(userId=1){

const [wallet,setWallet]=useState(null);

const [preferences,setPreferences]=useState(null);

const [loading,setLoading]=useState(true);


useEffect(()=>{


async function load(){


try{


const walletData =
await getWallet(userId);


const preferenceData =
await getUserPreferences(userId);


setWallet(mapWallet(walletData));

setPreferences(
preferenceData?.preferences || null
);


}catch(error){

console.error(
"Wallet intelligence failed",
error
);


}


setLoading(false);


}


load();


},[userId]);


return {

wallet,

preferences,

loading

};


}



import {useEffect,useState} from "react";

import {getMappedAssets} from "../services/api/assetApi";


export function useAssetIntelligence(){

const [assets,setAssets]=useState([]);

const [loading,setLoading]=useState(true);


useEffect(()=>{


async function load(){

try{

const data =
await getMappedAssets();

setAssets(data);


}catch(error){

console.error(
"Asset intelligence failed",
error
);


}


setLoading(false);


}


load();


},[]);


return {

assets,

loading

};


}


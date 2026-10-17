import {useEffect,useState} from "react";
import {getWallet} from "../../services/apren/walletApi";


export function useWallet(userId=1){

const [data,setData]=useState(null);
const [loading,setLoading]=useState(true);
const [error,setError]=useState(null);


useEffect(()=>{

getWallet(userId)
.then(setData)
.catch(setError)
.finally(()=>setLoading(false));

},[userId]);


return {
data,
loading,
error
};

}

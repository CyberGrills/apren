import {useEffect,useState} from "react";
import {getTrades} from "../../services/apren/tradeApi";


export function useTrades(){

const [data,setData]=useState([]);
const [loading,setLoading]=useState(true);
const [error,setError]=useState(null);


useEffect(()=>{

getTrades()
.then((res)=>setData(res.trades || []))
.catch(setError)
.finally(()=>setLoading(false));


},[]);


return {
data,
loading,
error
};

}

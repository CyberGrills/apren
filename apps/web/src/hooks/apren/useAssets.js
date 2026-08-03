import {useEffect,useState} from "react";
import {getAssets} from "../../services/apren/assetApi";


export function useAssets(){

const [data,setData]=useState([]);
const [loading,setLoading]=useState(true);
const [error,setError]=useState(null);


useEffect(()=>{

getAssets()
.then((res)=>setData(res.assets || []))
.catch(setError)
.finally(()=>setLoading(false));


},[]);


return {
data,
loading,
error
};

}

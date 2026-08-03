import {useEffect,useState} from "react";
import {getBrainAsset} from "../../services/apren/brainApi";


export function useBrain(assetId){

const [data,setData]=useState(null);
const [loading,setLoading]=useState(true);
const [error,setError]=useState(null);


useEffect(()=>{

if(!assetId){
 setLoading(false);
 return;
}


getBrainAsset(assetId)
.then(setData)
.catch(setError)
.finally(()=>setLoading(false));


},[assetId]);


return {
data,
loading,
error
};

}

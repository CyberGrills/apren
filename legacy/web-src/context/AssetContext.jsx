
import React,{createContext,useContext} from "react";

import {useAssetIntelligence} from "../hooks/useAssetIntelligence";


const AssetContext=createContext(null);


export function AssetProvider({children}){


const assetData =
useAssetIntelligence();


return (

<AssetContext.Provider value={assetData}>

{children}

</AssetContext.Provider>

);


}


export function useAssets(){

return useContext(AssetContext);

}


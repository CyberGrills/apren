
import {SERVICES} from "../../config/services";
import {apiRequest} from "./client";


export function getAssets(){

return apiRequest(
`${SERVICES.assets}/assets`
);

}


export function getAsset(id){

return apiRequest(
`${SERVICES.assets}/assets/${id}`
);

}



import { mapAssets } from "../mappers/assetMapper";


export async function getMappedAssets(){

const data =
await getAssets();

return mapAssets(data);

}


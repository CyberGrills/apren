import {apiGet} from "./client";
import {APREN_SERVICES} from "./config";


export function getBrainAsset(id){

 return apiGet(
   `${APREN_SERVICES.intelligence}/brain/asset/${id}`
 );

}

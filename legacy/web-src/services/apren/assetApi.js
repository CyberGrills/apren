import {apiGet} from "./client";
import {APREN_SERVICES} from "./config";


export function getAssets(){

 return apiGet(
   `${APREN_SERVICES.assets}/assets`
 );

}


export function getAsset(id){

 return apiGet(
   `${APREN_SERVICES.assets}/assets/${id}`
 );

}


export function getAssetEvents(id){

 return apiGet(
   `${APREN_SERVICES.assets}/assets/${id}/events`
 );

}

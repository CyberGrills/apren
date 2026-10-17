import {apiGet} from "./client";
import {APREN_SERVICES} from "./config";


export function getTrades(){

 return apiGet(
   `${APREN_SERVICES.trade}/trade`
 );

}

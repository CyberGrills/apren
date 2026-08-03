import {apiGet} from "./client";
import {APREN_SERVICES} from "./config";


export function getWallet(userId=1){

  return apiGet(
    `${APREN_SERVICES.wallet}/wallet/${userId}`
  );

}

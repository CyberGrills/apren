
import {SERVICES} from "../../config/services";
import {apiRequest} from "./client";


export function getWallet(userId=1){

return apiRequest(
`${SERVICES.wallet}/wallet/${userId}`
);

}


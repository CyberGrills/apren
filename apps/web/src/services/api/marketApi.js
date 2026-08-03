
import {SERVICES} from "../../config/services";
import {apiRequest} from "./client";


export function getMarket(){

return apiRequest(
`${SERVICES.market}/market`
);

}


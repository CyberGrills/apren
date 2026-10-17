
import {SERVICES} from "../../config/services";
import {apiRequest} from "./client";


export function getTrades(){

return apiRequest(
`${SERVICES.trade}/trade`
);

}

export function executeTrade(data){

return apiRequest(
`${SERVICES.trade}/trade/execute`,
{
method:"POST",
body:JSON.stringify(data)
}
);

}


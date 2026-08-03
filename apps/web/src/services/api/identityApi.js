
import {SERVICES} from "../../config/services";
import {apiRequest} from "./client";


export function getUser(id=1){

return apiRequest(
`${SERVICES.identity}/users/${id}`
);

}


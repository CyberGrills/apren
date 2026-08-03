
import { SERVICES } from "../../config/services";
import { apiRequest } from "./client";


export function getUserPreferences(userId=1){

return apiRequest(

`${SERVICES.identity}/users/${userId}/preferences`

);

}


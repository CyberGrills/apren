
import {SERVICES} from "../../config/services";
import {apiRequest} from "./client";


export function getNotifications(userId=1){

return apiRequest(
`${SERVICES.notification}/notifications/${userId}`
);

}



import {SERVICES} from "../../config/services";
import {apiRequest} from "./client";


export function getAssetBrain(id){

return apiRequest(
`${SERVICES.intelligence}/brain/asset/${id}`
);

}


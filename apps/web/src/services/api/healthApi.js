
import {SERVICES} from "../../config/services";


export async function checkServices(){

const services={};


for(
const [name,url]
of Object.entries(SERVICES)
){

try{

const res=
await fetch(url);


services[name]=res.ok;

}catch{

services[name]=false;

}

}


return services;

}


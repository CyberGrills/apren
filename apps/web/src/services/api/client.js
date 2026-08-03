
export async function apiRequest(url, options={}){

try{

const response =
await fetch(
url,
{
headers:{
"Content-Type":"application/json",
},
...options
}
);


if(!response.ok){

throw new Error(
`API error ${response.status}`
);

}


return await response.json();


}catch(error){

console.error(
"āprən API error:",
error
);


return null;

}

}


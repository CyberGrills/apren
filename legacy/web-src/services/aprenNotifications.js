
const NOTIFICATION_URL="http://localhost:4007";


export async function getNotifications(userId=1){

try{

const res =
await fetch(
`${NOTIFICATION_URL}/notifications/${userId}`
);


if(!res.ok){
throw new Error("notification failed");
}


return await res.json();


}catch(error){

console.error(
"Notification service unavailable",
error
);


return {
notifications:[]
};

}

}


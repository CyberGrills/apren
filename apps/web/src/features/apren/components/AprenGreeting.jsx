
import React from "react";
import {
    getTimeGreeting,
    getCurrentTime
} from "../../../services/timeGreeting";


export default function AprenGreeting({
    userName="Chef"
}){


return (

<div className="
rounded-3xl
p-6
bg-black
text-white
border
border-cyan-400/30
">

<h1 className="text-3xl font-bold">

{getTimeGreeting(userName)}

</h1>


<p className="mt-2 opacity-70">

Your āprən Food Wallet is ready.

</p>


<div className="mt-4 text-sm">

Local time:
{" "}
{getCurrentTime()}

</div>


</div>

);

}


import React from "react";


export default function FoodAssetProfile({
    profile,
    currency="EUR"
}){


if(!profile){
    return null;
}


const asset =
    profile.asset;


const freshness =
    profile.intelligence?.freshness;


const passport =
    profile.passport;


return (

<div className="rounded-3xl p-6 bg-black text-white border border-cyan-400/30">

<h2 className="text-2xl font-bold">
{asset.name}
</h2>


<p className="opacity-70">
Origin: {asset.kitchen}
</p>


<div className="mt-5 grid gap-4">


<div>
Freshness
<div className="text-3xl">
{freshness?.score || 0}%
</div>
</div>


<div>
Food Intelligence Value
<div className="text-3xl">
{asset.base_value} ə
</div>
</div>


<div>
Currency View
<div className="text-xl">
{currency} {asset.base_value}
</div>
</div>


<div>
Demand
<div>
{asset.demand}
</div>
</div>


<div>
Passport
<div>
{passport ? "Verified ✓" : "Pending"}
</div>
</div>


</div>


</div>

);

}


export default function FoodAssetCard({
asset
}){


return (

<div className="rounded-2xl p-5 bg-black text-white">

<h3 className="text-xl">
{asset.name}
</h3>


<p>
Freshness:
{asset.freshness_score}%
</p>


<p>
Currency:
{asset.currency}
</p>


<p>
Status:
{asset.status}
</p>


</div>

)

}


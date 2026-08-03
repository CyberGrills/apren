
const ASSET_API =
"http://localhost:4003";


export async function getFoodAsset(id){

const res =
await fetch(
`${ASSET_API}/asset-profile/${id}`
);

return res.json();

}



export async function analyzeFood(id){

const res =
await fetch(
`${ASSET_API}/assets/${id}/analyze-food`,
{
method:"POST"
}
);

return res.json();

}



export async function getMarketValue(id){

const res =
await fetch(
`${ASSET_API}/assets/${id}/market-value`
);

return res.json();

}


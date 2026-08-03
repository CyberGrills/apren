
export function mapAsset(asset){

return {

id: asset.id,

name: asset.name,

kitchen: asset.kitchen,

origin: asset.kitchen,

category: asset.category,

freshness:
asset.freshness_score ?? 0,

price:
asset.base_value ?? 0,

currency:
asset.currency ?? "ə",

change:0,

demand:
asset.demand ?? "Stable",

status:
asset.status,

expiry:
asset.expiry_time,

journey:[

"Farm",

asset.kitchen,

"You"

],

history:[],

log:[],

journey:[
  "Farm",
  asset.kitchen,
  "You"
]

};

}


export function mapAssets(data){

return (
data?.assets?.map(mapAsset)
||
[]
);

}


const GATEWAY_API = "http://localhost:4000/api";

export async function getFoodAssets(){
  const response = await fetch(`${GATEWAY_API}/assets`);

  if(!response.ok){
    throw new Error("Unable to load food assets");
  }

  const data = await response.json();
  return data.assets;
}

export async function apiGet(url){

  const response = await fetch(url);

  if(!response.ok){
    throw new Error(
      `API error ${response.status}: ${url}`
    );
  }

  return response.json();
}

const API =
    import.meta.env.VITE_ASSET_API ||
    "http://localhost:4003";


async function request(path){

    const res = await fetch(
        `${API}${path}`
    );

    if(!res.ok){
        throw new Error(
            `Asset API error ${res.status}`
        );
    }

    return res.json();
}


export function getAsset(id){

    return request(
        `/assets/${id}`
    );

}


export function getAssetProfile(id){

    return request(
        `/asset-profile/${id}`
    );

}


export function analyzeFood(id){

    return fetch(
        `${API}/assets/${id}/analyze-food`,
        {
            method:"POST"
        }
    )
    .then(r=>r.json());

}


export function getMarketValue(id){

    return request(
        `/assets/${id}/market-value`
    );

}


export function getMarketIntelligence(id){

    return request(
        `/assets/${id}/market-intelligence`
    );

}

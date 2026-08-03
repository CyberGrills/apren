function calculateDecay(asset){

    const now = Date.now();


    let hours = 0;


    if(asset.created_at){

        hours =
        (now - new Date(asset.created_at).getTime())
        /
        (1000*60*60);

    }


    let freshness;


    if(
        asset.category === "Prepared meals" ||
        asset.category === "Produce"
    ){

        freshness =
            Math.max(
                0,
                100 - (hours / 24 * 100)
            );

    }
    else {

        freshness = 100;

    }


    return {

        freshnessScore:
            Math.round(freshness),

        hoursSinceCreation:
            Math.round(hours),

        lifecycle:
            freshness <= 0
            ? "EXPIRED"
            : "FRESH"

    };

}


module.exports = calculateDecay;

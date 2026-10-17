
function calculateDecay(asset){

    const now = new Date();

    const verified =
        new Date(
            asset.verifiedAt || now
        );


    let lifetimeHours = 24;


    if(asset.category === "Prepared meals"){
        lifetimeHours = 24;
    }


    if(asset.category === "Produce"){
        lifetimeHours = 72;
    }


    if(asset.category === "Grains"){
        lifetimeHours = 720;
    }


    const ageHours =
        (now - verified) /
        (1000 * 60 * 60);


    let remainingHours =
        lifetimeHours - ageHours;


    if(remainingHours < 0){
        remainingHours = 0;
    }


    const freshness =
        Math.round(
            (remainingHours / lifetimeHours) * 100
        );


    let state="FRESH";


    if(freshness <= 50){
        state="WARNING";
    }


    if(freshness <= 20){
        state="EXPIRING";
    }


    if(freshness === 0){
        state="EXPIRED";
    }


    return {

        freshness,

        remainingHours:
            Number(
              remainingHours.toFixed(2)
            ),

        lifetimeHours,

        state,

        checkedAt:
            now.toISOString()

    };

}


module.exports=calculateDecay;


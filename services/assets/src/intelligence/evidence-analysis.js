
function analyzeEvidence(evidence){

    const baseScore = 90;

    const freshnessScore =
        Math.min(
            100,
            baseScore + Math.floor(Math.random()*10)
        );


    const confidence =
        Math.floor(
            85 + Math.random()*15
        );


    const expiry =
        new Date(
            Date.now() +
            24 * 60 * 60 * 1000
        ).toISOString();


    return {

        freshnessScore,

        confidence,

        estimatedExpiry: expiry,

        status:"ANALYZED"

    };

}


module.exports = analyzeEvidence;

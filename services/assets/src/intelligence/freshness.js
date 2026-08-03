function analyzeFreshness(asset){

    const now = new Date();

    let expiryHours = 24;

    if(asset.category === "Prepared meals"){
        expiryHours = 24;
    }

    if(asset.category === "Produce"){
        expiryHours = 72;
    }

    if(asset.category === "Grains"){
        expiryHours = 720;
    }

    const score = Math.min(
        100,
        Math.max(
            0,
            asset.imageConfidence || 90
        )
    );

    const expiry = new Date(
        now.getTime() + expiryHours * 60 * 60 * 1000
    );

    return {
        score,
        estimatedExpiry: expiry.toISOString(),
        confidence: score
    };
}

module.exports = analyzeFreshness;

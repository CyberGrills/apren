function detectFood(asset){

    const category =
        asset.category ||
        "unknown";


    const perishability =
        [
            "Prepared meals",
            "Produce",
            "Meat",
            "Dairy",
            "Seafood"
        ].includes(category)
        ? "perishable"
        : "non-perishable";


    return {

        detectedProduct: asset.name,

        category,

        perishability,

        confidence:95

    };

}


module.exports = detectFood;

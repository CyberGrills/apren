function adjustValue(asset,freshness){

    const multiplier =
        freshness.freshnessScore / 100;


    return {

        originalValue:
            asset.base_value,


        currentValue:
            Number(
              (
              asset.base_value *
              multiplier
              ).toFixed(2)
            ),


        currency:
            asset.currency


    };

}


module.exports = adjustValue;


export function getUserCurrency(){

    return (
        localStorage.getItem(
            "apren_currency"
        )
        ||
        "EUR"
    );

}


export function setUserCurrency(currency){

    localStorage.setItem(
        "apren_currency",
        currency
    );

}



export function formatCurrency(
amount,
currency="EUR"
){

try{

return new Intl.NumberFormat(
undefined,
{
style:"currency",
currency
}
).format(amount);


}catch{

return `${amount} ${currency}`;

}

}


export function formatFoodCurrency(amount){

return `${amount} ə`;

}


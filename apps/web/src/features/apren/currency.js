

export function formatCurrency(
amount,
currency="EUR"
){

return new Intl.NumberFormat(
undefined,
{
style:"currency",
currency
}
).format(amount);

}



export function userCurrency(user){

return (
user?.preferred_currency ||
"EUR"
);

}


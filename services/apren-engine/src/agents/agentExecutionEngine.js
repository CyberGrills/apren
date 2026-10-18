function execute(action){


let result="WAIT";


switch(action){

case "FAST_MOVE":

result="NOTIFY_SELLER";

break;


case "PROMOTE":

result="BOOST_VISIBILITY";

break;


case "INCREASE_SUPPLY":

result="ALERT_SUPPLIER";

break;


default:

result="MONITOR";

}



return {

action,

execution:result

};

}



module.exports={
execute
};


export function getTimeGreeting(name="User"){

    const hour = new Date().getHours();

    let greeting="";


    if(hour >= 5 && hour < 12){

        greeting = "Good morning";

    } 
    else if(hour >= 12 && hour < 17){

        greeting = "Good afternoon";

    }
    else if(hour >= 17 && hour < 22){

        greeting = "Good evening";

    }
    else {

        greeting = "Good night";

    }


    return `${greeting}, ${name} 👋`;

}



export function getCurrentTime(){

    return new Date()
        .toLocaleTimeString(
            [],
            {
                hour:"2-digit",
                minute:"2-digit"
            }
        );

}



export function getUserTimezone(){

    return Intl
        .DateTimeFormat()
        .resolvedOptions()
        .timeZone;

}


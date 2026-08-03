const events = {};

function createEvent(assetId,type,description){

    if(!events[assetId]){
        events[assetId]=[];
    }

    const event={
        id: events[assetId].length+1,
        asset_id:Number(assetId),
        event_type:type,
        description,
        created_at:new Date().toISOString()
    };

    events[assetId].push(event);

    return event;
}


function getEvents(assetId){

    return events[assetId] || [];

}


module.exports={
    createEvent,
    getEvents
};

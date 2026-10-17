function analyze(data){

let freshness=70;

let confidence=60;



if(data.image_reference){

freshness+=10;
confidence+=10;

}


if(data.video_reference){

freshness+=10;
confidence+=10;

}



freshness=Math.min(
100,
freshness
);


confidence=Math.min(
100,
confidence
);



return {

freshness_score:freshness,

confidence

};

}


module.exports={
analyze
};

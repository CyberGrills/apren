const fs = require("fs");
const path = require("path");

const records = [];


function verifyFood(asset){

    const confidence = Math.floor(
        85 + Math.random() * 15
    );

    const verification = {

        id: records.length + 1,

        assetId: Number(asset.id),

        evidenceType:
            asset.type || "image",

        file:
            asset.file || null,

        confidence,

        status:"VERIFIED",

        createdAt:
            new Date().toISOString()

    };


    records.push(verification);


    return verification;
}


function getVerification(assetId){

    return records.filter(
        r => r.assetId === Number(assetId)
    );

}


module.exports={
    verifyFood,
    getVerification
};

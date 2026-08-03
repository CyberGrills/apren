function score(simulation){

let score = 0;


const impact =
simulation.impact?.scores || {};


score += impact.value_protection || 0;
score += impact.waste_prevention || 0;
score += impact.user_benefit || 0;


return score;

}


module.exports = {
score
};

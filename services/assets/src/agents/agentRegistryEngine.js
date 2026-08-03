
const {pool}=require("../postgres");


async function register(){

const agents=[

[
"FARM_AGENT",
"SOURCE_INTELLIGENCE",
80
],

[
"MARKET_AGENT",
"DEMAND_INTELLIGENCE",
90
],

[
"KITCHEN_AGENT",
"CONSUMPTION_INTELLIGENCE",
85
],

[
"LOGISTICS_AGENT",
"MOVEMENT_INTELLIGENCE",
88
],

[
"VALUE_AGENT",
"ECONOMIC_INTELLIGENCE",
92
]

];


for(const agent of agents){

await pool.query(
`
INSERT INTO food_brain_agents
(
agent_name,
domain,
priority
)

VALUES($1,$2,$3)

ON CONFLICT(agent_name)
DO NOTHING
`,
agent
);

}


return agents;

}


module.exports={
register
};


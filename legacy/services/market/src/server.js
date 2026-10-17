const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const marketData = {
  system: "apren-market-engine",
  summary: {
    supply: "balanced",
    demand: "stable",
    freshnessIndex: 88,
  },
  priceSignals: [
    { category: "Produce", recommendation: "Buy local tomatoes", score: 92 },
    { category: "Grains", recommendation: "Rice prices steady", score: 78 },
    { category: "Prepared meals", recommendation: "High freshness meal demand", score: 85 },
  ],
};

app.get("/market", (req, res) => {
  res.json(marketData);
});

app.get("/market/prices", (req, res) => {
  res.json({
    system: "apren-market-engine",
    prices: [
      { item: "Chicken Rice Bowl", price: 15, change: 4 },
      { item: "Heirloom Tomatoes", price: 6, change: 8 },
      { item: "Jasmine Rice 5kg", price: 11, change: 0 },
    ],
  });
});

app.listen(4004, () => {
  console.log("āprən Market Engine running on 4004");
});

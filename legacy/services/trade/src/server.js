const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const trades = [
  {
    id: 1,
    from: "Jasmine Rice 5kg",
    to: "Yellow Yams",
    ratio: "1 -> 2.2",
    status: "available",
  },
  {
    id: 2,
    from: "Heirloom Tomatoes",
    to: "Chicken Rice Bowl",
    ratio: "3 -> 1.2",
    status: "available",
  },
];

app.get("/trade", (req, res) => {
  res.json({
    system: "apren-trade-engine",
    trades,
  });
});

app.post("/trade/execute", (req, res) => {
  const { tradeId, userId } = req.body;
  const trade = trades.find((item) => item.id === Number(tradeId));

  if (!trade) {
    return res.status(404).json({
      system: "apren-trade-engine",
      error: "Trade not found",
    });
  }

  res.json({
    system: "apren-trade-engine",
    executed: true,
    tradeId: trade.id,
    userId: userId || null,
    executedAt: new Date().toISOString(),
  });
});

if (process.env.VERCEL !== "1") {
  app.listen(4006, () => {
    console.log("āprən Trade Engine running on 4006");
  });
}

module.exports = app;

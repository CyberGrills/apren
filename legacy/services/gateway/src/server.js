const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const SERVICES = {
  assets: process.env.ASSETS_URL || "http://localhost:4003",
  identity: process.env.IDENTITY_URL || "http://localhost:4001",
  wallet: process.env.WALLET_URL || "http://localhost:4002",
  market: process.env.MARKET_URL || "http://localhost:4004",
  intelligence: process.env.INTELLIGENCE_URL || "http://localhost:4005",
  trade: process.env.TRADE_URL || "http://localhost:4006",
};

async function forwardRequest(req, res, targetBase) {
  try {
    const url = `${targetBase}${req.originalUrl.replace(/^\/api/, "")}`;
    const response = await axios({
      url,
      method: req.method,
      // forward incoming headers (Authorization, etc.) but remove host
      headers: (() => {
        const hdrs = Object.assign({}, req.headers);
        if (hdrs.host) delete hdrs.host;
        if (!hdrs.accept) hdrs.accept = "application/json";
        return hdrs;
      })(),
      params: req.query,
      data: req.body,
      timeout: 10000,
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 502;
    const message = error.response ? error.response.data : error.message;
    res.status(status).json({
      system: "apren-gateway",
      error: "Unable to proxy request",
      details: message,
      upstream: error.config ? error.config.url : undefined,
    });
  }
}

app.get("/api/health", async (req, res) => {
  const status = {};
  const checks = {
    assets: `${SERVICES.assets}/assets`,
    identity: `${SERVICES.identity}/users/1`,
    wallet: `${SERVICES.wallet}/wallet/1`,
    market: `${SERVICES.market}/market`,
    intelligence: `${SERVICES.intelligence}/brain/asset/1`,
    trade: `${SERVICES.trade}/trade`,
  };

  await Promise.all(
    Object.entries(checks).map(async ([key, url]) => {
      try {
        await axios.get(url, { timeout: 3000 });
        status[key] = "ok";
      } catch (error) {
        status[key] = "down";
      }
    })
  );

  res.json({
    system: "apren-gateway",
    status,
  });
});

app.use("/api/assets", (req, res) => forwardRequest(req, res, SERVICES.assets));
app.use("/api/passport", (req, res) => forwardRequest(req, res, SERVICES.assets));
app.use("/api/ownership", (req, res) => forwardRequest(req, res, SERVICES.assets));
app.use("/api/asset-profile", (req, res) => forwardRequest(req, res, SERVICES.assets));
app.use("/api/users", (req, res) => forwardRequest(req, res, SERVICES.identity));
app.use("/api/wallet", (req, res) => forwardRequest(req, res, SERVICES.wallet));
app.use("/api/brain", (req, res) => forwardRequest(req, res, SERVICES.intelligence));
app.use("/api/market", (req, res) => forwardRequest(req, res, SERVICES.market));
app.use("/api/trade", (req, res) => forwardRequest(req, res, SERVICES.trade));

if (process.env.VERCEL !== "1") {
  app.listen(4000, () => {
    console.log("āprən Gateway running on 4000");
  });
}

module.exports = app;

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = Number(process.env.GATEWAY_PORT || 4000);

const services = {
  identity: process.env.IDENTITY_URL || "http://localhost:4001",
  wallet: process.env.WALLET_URL || "http://localhost:4002",
  assets: process.env.ASSETS_URL || "http://localhost:4003",
  market: process.env.MARKET_URL || "http://localhost:4004",
  intelligence: process.env.INTELLIGENCE_URL || "http://localhost:4005",
  trade: process.env.TRADE_URL || "http://localhost:4006",
  hospitality: process.env.HOSPITALITY_URL || "http://localhost:4007"
};

const JWT_SECRET = process.env.APREN_JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("APREN_JWT_SECRET is required for gateway authentication");
}

app.use(helmet());
app.use(cors());
app.use(express.json({
  limit: "1mb",
  verify(req, res, buffer) { req.rawBody = Buffer.from(buffer); }
}));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

function extractBearer(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

async function authenticate(req, res, next) {
  let token;
  let payload;

  try {
    token = extractBearer(req);

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    payload = jwt.verify(token, JWT_SECRET, {
      issuer: "apren-identity",
      audience: "apren-api"
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }

  try {
    const sessionResponse = await axios.get(
      `${services.identity}/auth/session`,
      {
        headers: { authorization: `Bearer ${token}` },
        timeout: 3000,
        validateStatus: () => true
      }
    );

    if (sessionResponse.status === 401 || sessionResponse.status === 403) {
      return res.status(401).json({ error: "Session expired or revoked" });
    }

    if (sessionResponse.status < 200 || sessionResponse.status >= 300) {
      return res.status(503).json({ error: "Authentication service unavailable" });
    }

    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      email: payload.email
    };

    return next();
  } catch (error) {
    console.error("Gateway session validation failed:", error.message);
    return res.status(503).json({ error: "Authentication service unavailable" });
  }
}

function authProxy(serviceUrl, upstreamPathBuilder) {
  return async (req, res) => {
    try {
      const targetPath = upstreamPathBuilder(req);

      const response = await axios({
        method: req.method,
        url: `${serviceUrl}${targetPath}`,
        params: req.query,
        data: req.body,
        headers: {
          authorization: req.headers.authorization || "",
          "content-type": req.headers["content-type"] || "application/json",
          "idempotency-key": req.headers["idempotency-key"] || ""
        },
        validateStatus: () => true,
        timeout: 10000
      });

      res.status(response.status).send(response.data);
    } catch (error) {
      console.error("Gateway proxy error:", error.message);

      res.status(502).json({
        error: "Upstream service unavailable"
      });
    }
  };
}

function publicProxy(serviceUrl, upstreamPathBuilder) {
  return async (req, res) => {
    try {
      const targetPath = upstreamPathBuilder(req);

      const response = await axios({
        method: req.method,
        url: `${serviceUrl}${targetPath}`,
        params: req.query,
        data: req.body,
        validateStatus: () => true,
        timeout: 10000
      });

      res.status(response.status).send(response.data);
    } catch (error) {
      console.error("Gateway proxy error:", error.message);

      res.status(502).json({
        error: "Upstream service unavailable"
      });
    }
  };
}

app.get("/api/health", async (req, res) => {
  const checks = {};
  const probePaths = {
    identity: "/health",
    wallet: "/wallet/1",
    assets: "/assets",
    market: "/market",
    intelligence: "/brain/asset/1",
    trade: "/trade",
    hospitality: "/health"
  };

  await Promise.all(
    Object.entries(services).map(async ([name, baseUrl]) => {
      try {
        const response = await axios.get(
          `${baseUrl}${probePaths[name]}`,
          { timeout: 3000, validateStatus: () => true }
        );

        checks[name] = response.status < 500 ? "up" : "down";
      } catch {
        checks[name] = "down";
      }
    })
  );

  const healthy = Object.values(checks).every(status => status === "up");

  return res.status(healthy ? 200 : 503).json({
    system: "apren-gateway",
    status: healthy ? "ok" : "degraded",
    services: checks
  });
});

app.post(
  "/api/auth/register",
  publicProxy(services.identity, () => "/auth/register")
);

app.post(
  "/api/auth/login",
  publicProxy(services.identity, () => "/auth/login")
);

app.get(
  "/api/auth/me",
  authenticate,
  authProxy(services.identity, () => "/auth/me")
);

app.post(
  "/api/auth/logout",
  authenticate,
  authProxy(services.identity, () => "/auth/logout")
);

app.use(
  "/api/users",
  authenticate,
  authProxy(services.identity, req => `/users${req.path}`)
);

app.use(
  "/api/wallet",
  authenticate,
  authProxy(services.wallet, req => `/wallet${req.path}`)
);

app.use(
  "/api/assets",
  authenticate,
  authProxy(services.assets, req => `/assets${req.path}`)
);

app.use(
  "/api/passport",
  authenticate,
  authProxy(services.assets, req => `/passport${req.path}`)
);

app.use(
  "/api/ownership",
  authenticate,
  authProxy(services.assets, req => `/ownership${req.path}`)
);

app.use(
  "/api/asset-profile",
  authenticate,
  authProxy(services.assets, req => `/asset-profile${req.path}`)
);

app.use(
  "/api/market",
  authenticate,
  authProxy(services.market, req => `/market${req.path}`)
);

app.use(
  "/api/brain",
  authenticate,
  authProxy(services.intelligence, req => `/brain${req.path}`)
);

app.use(
  "/api/trade",
  authenticate,
  authProxy(services.trade, req => `/trade${req.path}`)
);

app.get(
  "/api/hospitality/discover",
  publicProxy(services.hospitality, req => "/hospitality/discover")
);

app.post(
  "/api/hospitality/arrival-intents",
  publicProxy(services.hospitality, () => "/hospitality/arrival-intents")
);

app.post("/api/hospitality/webhooks/paystack", async (req, res) => {
  try {
    const response = await axios({
      method: "POST",
      url: services.hospitality + "/hospitality/webhooks/paystack",
      data: req.rawBody || Buffer.from(JSON.stringify(req.body || {})),
      headers: {
        "content-type": "application/json",
        "x-paystack-signature": req.headers["x-paystack-signature"] || ""
      },
      validateStatus: () => true,
      timeout: 10000
    });
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error("Paystack webhook proxy error:", error.message);
    return res.status(502).json({ error: "Paystack webhook service unavailable" });
  }
});

app.use(
  "/api/hospitality",
  authenticate,
  authProxy(services.hospitality, req => `/hospitality${req.path}`)
);

app.use((req, res) => {
  res.status(404).json({
    error: "Gateway route not found"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`āprən gateway listening on :${PORT}`);
});

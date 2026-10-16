const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.APREN_JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("APREN_JWT_SECRET is required for the identity service");
}

const ACCESS_TOKEN_TTL = process.env.APREN_ACCESS_TOKEN_TTL || "15m";

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: "apren-identity",
      audience: "apren-api",
      jwtid: crypto.randomUUID()
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: "apren-identity",
    audience: "apren-api"
  });
}

function decodeAccessToken(token) {
  return jwt.decode(token);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  decodeAccessToken
};

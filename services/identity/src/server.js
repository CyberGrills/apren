const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");

const pool = require("../../shared/db");
const { hashPassword, verifyPassword } = require("./auth/password");
const { signAccessToken, verifyAccessToken, decodeAccessToken } = require("./auth/token");

const app = express();

const PORT = Number(process.env.IDENTITY_PORT || 4001);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200)
});

function publicUser(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    role: row.role
  };
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Administrator access required" });
  }
  return next();
}

function extractBearer(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

async function requireAuth(req, res, next) {
  let payload;

  try {
    const token = extractBearer(req);

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    payload = verifyAccessToken(token);

    if (!payload.jti || !payload.sub) {
      return res.status(401).json({ error: "Invalid or expired access token" });
    }
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }

  try {
    const session = await pool.query(
      `SELECT id
       FROM user_sessions
       WHERE token_jti = $1
         AND user_id = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [payload.jti, payload.sub]
    );

    if (session.rowCount === 0) {
      return res.status(401).json({ error: "Session expired or revoked" });
    }

    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      email: payload.email,
      jti: payload.jti
    };

    return next();
  } catch (error) {
    console.error("Session validation failed:", error.message);
    return res.status(503).json({ error: "Authentication service unavailable" });
  }
}

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      service: "apren-identity",
      status: "ok"
    });
  } catch (error) {
    console.error("Identity health check failed:", error.message);
    res.status(503).json({
      service: "apren-identity",
      status: "down",
      error: "Database unavailable"
    });
  }
});

app.post("/auth/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid registration data",
      details: parsed.error.flatten()
    });
  }

  const { name, email, password } = parsed.data;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );

    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "An account with that email already exists"
      });
    }

    const userResult = await client.query(
      `
      INSERT INTO users (name, email, role)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, role
      `,
      [name, email, "customer"]
    );

    const user = userResult.rows[0];

    const passwordHash = await hashPassword(password);

    await client.query(
      `
      INSERT INTO user_credentials (
        user_id,
        password_hash
      )
      VALUES ($1, $2)
      `,
      [user.id, passwordHash]
    );

    const token = signAccessToken(user);
    const claims = decodeAccessToken(token);

    await client.query(
      `INSERT INTO user_sessions (user_id, token_jti, expires_at)
       VALUES ($1, $2, TO_TIMESTAMP($3))`,
      [user.id, claims.jti, claims.exp]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      user: publicUser(user),
      accessToken: token
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Registration error:", error);

    return res.status(500).json({
      error: "Registration failed"
    });
  } finally {
    client.release();
  }
});

app.post("/auth/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid login data"
    });
  }

  const { email, password } = parsed.data;

  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        c.password_hash
      FROM users u
      INNER JOIN user_credentials c
        ON c.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
      `,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const row = result.rows[0];

    const valid = await verifyPassword(
      password,
      row.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const token = signAccessToken(row);
    const claims = decodeAccessToken(token);

    await pool.query(
      `INSERT INTO user_sessions (user_id, token_jti, expires_at)
       VALUES ($1, $2, TO_TIMESTAMP($3))`,
      [row.id, claims.jti, claims.exp]
    );

    return res.json({
      user: publicUser(row),
      accessToken: token
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Login failed"
    });
  }
});

app.get("/auth/session", requireAuth, (req, res) => {
  return res.json({ valid: true, userId: req.user.id });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, email, role
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    return res.json({
      user: publicUser(result.rows[0])
    });
  } catch (error) {
    console.error("Auth me error:", error);

    return res.status(500).json({
      error: "Unable to load authenticated user"
    });
  }
});

app.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE token_jti = $1
         AND user_id = $2
         AND revoked_at IS NULL`,
      [req.user.jti, req.user.id]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Logout failed:", error.message);
    return res.status(500).json({ error: "Logout failed" });
  }
});

app.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, email, role
      FROM users
      ORDER BY id
      `
    );

    res.json({
      system: "apren-identity",
      users: result.rows.map(publicUser)
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load users"
    });
  }
});

app.get("/users/:id", requireAuth, async (req, res) => {
  if (req.user.role !== "admin" &&
      String(req.user.id) !== String(req.params.id)) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  try {
    const result = await pool.query(
      `
      SELECT id, name, email, role
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    res.json(publicUser(result.rows[0]));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load user"
    });
  }
});

app.get("/users/:id/preferences", requireAuth, async (req, res) => {
  if (req.user.role !== "admin" &&
      String(req.user.id) !== String(req.params.id)) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM user_preferences
      WHERE user_id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    res.json({
      userId: Number(req.params.id),
      preferences: result.rows[0] || null
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load preferences"
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Identity route not found"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`āprən identity service listening on :${PORT}`);
});

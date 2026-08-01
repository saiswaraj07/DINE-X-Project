const express = require("express");
const cors = require("cors");
const crypto = require("node:crypto");
const path = require("node:path");
const { pool, initSchema } = require("./db");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const STATUSES = ["PLACED", "UNDER_PROCESS", "COMPLETED"];
// token -> expiry epoch ms; entries are pruned on every auth check
const adminTokens = new Map();
const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());
// Only the public/ directory is web-reachable; backend code and config live
// outside it, so no source or secret can be fetched over HTTP.
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "Server and DB are connected." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Database connection failed." });
  }
});

app.post("/api/orders/delivery", async (req, res) => {
  try {
    const { name, email, mobile, foodItem, address } = req.body;
    if (!name || !email || !mobile || !foodItem || !address) {
      return res.status(400).json({ ok: false, message: "All fields are required." });
    }

    const sql = `
      INSERT INTO orders (order_type, customer_name, email, mobile, food_item, address)
      VALUES ('DELIVERY', ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [name, email, mobile, foodItem, address]);
    return res.json({ ok: true, id: result.insertId, message: "Delivery order placed successfully." });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Failed to place delivery order." });
  }
});

app.post("/api/orders/takeaway", async (req, res) => {
  try {
    const { name, email, mobile, foodItem, pickupTime } = req.body;
    if (!name || !email || !mobile || !foodItem || !pickupTime) {
      return res.status(400).json({ ok: false, message: "All fields are required." });
    }

    const sql = `
      INSERT INTO orders (order_type, customer_name, email, mobile, food_item, pickup_time)
      VALUES ('TAKEAWAY', ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [name, email, mobile, foodItem, pickupTime]);
    return res.json({ ok: true, id: result.insertId, message: "Takeaway order placed successfully." });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Failed to place takeaway order." });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const { name, email, mobile, persons, diningTime } = req.body;
    if (!name || !email || !mobile || !persons || !diningTime) {
      return res.status(400).json({ ok: false, message: "All fields are required." });
    }
    if (!Number.isInteger(Number(persons)) || Number(persons) < 1) {
      return res.status(400).json({ ok: false, message: "Persons must be a positive number." });
    }

    const sql = `
      INSERT INTO bookings (customer_name, email, mobile, persons, dining_time)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [name, email, mobile, Number(persons), diningTime]);
    return res.json({ ok: true, id: result.insertId, message: "Table booking created successfully." });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Failed to create booking." });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    if (!name || !rating || !comment) {
      return res.status(400).json({ ok: false, message: "All fields are required." });
    }
    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ ok: false, message: "Rating must be between 1 and 5." });
    }

    const sql = `
      INSERT INTO reviews (customer_name, rating, comment)
      VALUES (?, ?, ?)
    `;
    const [result] = await pool.query(sql, [name, Number(rating), comment]);
    return res.json({ ok: true, id: result.insertId, message: "Review submitted successfully." });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Failed to submit review." });
  }
});

app.get("/api/reviews", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, customer_name, rating, comment, created_at FROM reviews ORDER BY id DESC LIMIT 20"
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Failed to load reviews." });
  }
});

// Hash-then-compare keeps the comparison constant-time regardless of input length.
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map(); // ip -> { count, firstAt }

app.post("/api/admin/login", (req, res) => {
  const { userId, password } = req.body || {};
  const adminUserId = process.env.ADMIN_USER_ID;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUserId || !adminPassword) {
    return res.status(500).json({ ok: false, message: "Admin credentials are not configured on the server." });
  }

  const ip = req.ip;
  const failures = loginFailures.get(ip);
  if (failures && Date.now() - failures.firstAt > LOGIN_WINDOW_MS) {
    loginFailures.delete(ip);
  } else if (failures && failures.count >= LOGIN_MAX_FAILURES) {
    return res.status(429).json({ ok: false, message: "Too many failed attempts. Try again later." });
  }

  if (!safeEqual(userId ?? "", adminUserId) || !safeEqual(password ?? "", adminPassword)) {
    const current = loginFailures.get(ip) || { count: 0, firstAt: Date.now() };
    current.count += 1;
    loginFailures.set(ip, current);
    return res.status(401).json({ ok: false, message: "Invalid user ID or password." });
  }

  loginFailures.delete(ip);
  const token = crypto.randomBytes(24).toString("hex");
  adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL_MS);
  return res.json({ ok: true, token, message: "Login successful." });
});

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function requireAdmin(req, res, next) {
  for (const [token, expiresAt] of adminTokens) {
    if (expiresAt <= Date.now()) adminTokens.delete(token);
  }
  const token = bearerToken(req);
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ ok: false, message: "Admin login required." });
  }
  next();
}

app.post("/api/admin/logout", (req, res) => {
  adminTokens.delete(bearerToken(req));
  return res.json({ ok: true, message: "Logged out." });
});

app.get("/api/admin/records", requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "ALL").toUpperCase();
    if (status !== "ALL" && !STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, message: "Invalid status filter." });
    }

    const where = status === "ALL" ? "" : "WHERE status = ?";
    const params = status === "ALL" ? [] : [status];
    const [orders] = await pool.query(
      `SELECT id, order_type AS record_type, customer_name, email, mobile,
              food_item, address, pickup_time, status, created_at
       FROM orders ${where}
       ORDER BY created_at DESC, id DESC LIMIT 200`,
      params
    );
    const [bookings] = await pool.query(
      `SELECT id, 'BOOKING' AS record_type, customer_name, email, mobile,
              persons, dining_time, status, created_at
       FROM bookings ${where}
       ORDER BY created_at DESC, id DESC LIMIT 200`,
      params
    );

    const records = [...orders, ...bookings].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id
    );
    return res.json({ ok: true, data: records });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Failed to load records." });
  }
});

app.patch("/api/admin/records/:type/:id/status", requireAdmin, async (req, res) => {
  try {
    const tables = { order: "orders", booking: "bookings" };
    const table = tables[req.params.type];
    const id = Number(req.params.id);
    const status = String((req.body || {}).status || "").toUpperCase();
    if (!table || !Number.isInteger(id)) {
      return res.status(400).json({ ok: false, message: "Invalid record type or id." });
    }
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, message: "Status must be PLACED, UNDER_PROCESS, or COMPLETED." });
    }

    const [result] = await pool.query(`UPDATE ${table} SET status = ? WHERE id = ?`, [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Record not found." });
    }
    return res.json({ ok: true, message: "Status updated." });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Failed to update status." });
  }
});

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`DineX running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database schema:", error.message);
    process.exit(1);
  });

const mysql = require("mysql2/promise");
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "dinex_restaurant",
  waitForConnections: true,
  connectionLimit: 10,
});

// Applies schema.sql (idempotent CREATE TABLE IF NOT EXISTS) so a fresh clone
// only needs the database itself to exist before `npm start`.
// Statements are split on a literal ";" — schema.sql must not contain a
// semicolon inside a string default or comment.
async function initSchema() {
  const statements = fs
    .readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await pool.query(statement);
  }
}

module.exports = { pool, initSchema };

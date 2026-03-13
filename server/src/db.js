const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@libsql/client");

dotenv.config({
  path: path.join(__dirname, "..", "..", ".env"),
  quiet: true
});

const url = process.env.TURSO_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_TOKEN || process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  throw new Error("Variable d'environnement manquante: TURSO_URL");
}

if (!authToken) {
  throw new Error("Variable d'environnement manquante: TURSO_TOKEN");
}

const db = createClient({
  url,
  authToken
});

async function initializeDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerName TEXT NOT NULL,
      phoneNumber TEXT NOT NULL,
      brand TEXT NOT NULL,
      requestedModel TEXT NOT NULL,
      storageCapacity TEXT,
      requestDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'en_attente',
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
}

module.exports = {
  db,
  initializeDatabase
};

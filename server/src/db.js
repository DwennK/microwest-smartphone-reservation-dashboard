const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDirectory = path.join(__dirname, "..", "data");
const databasePath = path.join(dataDirectory, "microwest.sqlite");

fs.mkdirSync(dataDirectory, { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
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

module.exports = db;

require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');

// DB_PATH is relative to the backend folder, so scripts work from any directory
const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/dishes.db');
const db = new Database(dbPath);

// IF NOT EXISTS makes this safe to run every time the app starts
db.exec(`
  CREATE TABLE IF NOT EXISTS dishes (
    dish_id      TEXT PRIMARY KEY,
    dish_name    TEXT NOT NULL,
    image_url    TEXT NOT NULL,
    is_published INTEGER NOT NULL,
    version      INTEGER NOT NULL DEFAULT 1
  )
`);

module.exports = db;

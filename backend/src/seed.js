const fs = require('fs');
const path = require('path');
const db = require('./db');

// Shared by seed.js and seedTest.js: inserts dishes from a JSON file
function seedFromFile(fileName) {
  const dishes = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'data', fileName), 'utf8')
  );

  // INSERT OR IGNORE skips rows whose dish_id already exists,
  // so re-running never duplicates dishes or overwrites edits/versions
  const insert = db.prepare(`
    INSERT OR IGNORE INTO dishes (dish_id, dish_name, image_url, is_published, version)
    VALUES (?, ?, ?, ?, 1)
  `);

  let added = 0;
  for (const d of dishes) {
    const result = insert.run(d.dishId, d.dishName, d.imageUrl, d.isPublished ? 1 : 0);
    added += result.changes; // 1 if inserted, 0 if ignored
  }
  const total = db.prepare('SELECT COUNT(*) AS n FROM dishes').get().n;
  console.log(`${fileName}: added ${added}, skipped ${dishes.length - added}. Total dishes in DB: ${total}`);
}

module.exports = seedFromFile;

// Run only when called directly (npm run seed), not when required by seedTest.js
if (require.main === module) {
  seedFromFile('seed.json');
}

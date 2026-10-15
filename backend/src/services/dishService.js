const db = require('../db');

// Convert a DB row (snake_case, 0/1) into the API shape (camelCase, boolean)
function toDish(row) {
  return {
    dishId: row.dish_id,
    dishName: row.dish_name,
    imageUrl: row.image_url,
    isPublished: row.is_published === 1,
    version: row.version,
  };
}

// Small helper so every error has the same shape: { status, error, message }
function fail(status, error, message, currentDish) {
  const err = new Error(message);
  err.status = status;
  err.error = error;
  if (currentDish) err.currentDish = currentDish;
  return err;
}

function getAllDishes() {
  const rows = db.prepare('SELECT * FROM dishes ORDER BY dish_id').all();
  return rows.map(toDish);
}

function getRow(dishId) {
  return db.prepare('SELECT * FROM dishes WHERE dish_id = ?').get(dishId);
}

// Only http:// and https:// URLs count as valid. new URL() throws on garbage.
function isValidImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Dish IDs are short ids like "1" or "test-1": letters, digits, "-" and "_" only
function isValidDishId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

function updateDish(dishId, body) {
  if (!isValidDishId(dishId)) {
    throw fail(400, 'VALIDATION_ERROR', 'dishId must be 1-64 letters, digits, "-" or "_"');
  }

  const { dishName, isPublished, expectedVersion } = body || {};

  // 1. Body validation -> 400
  if (typeof dishName !== 'string') {
    throw fail(400, 'VALIDATION_ERROR', 'dishName must be a string');
  }
  if (typeof isPublished !== 'boolean') {
    throw fail(400, 'VALIDATION_ERROR', 'isPublished must be a boolean (true or false)');
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
    throw fail(400, 'VALIDATION_ERROR', 'expectedVersion must be a positive integer');
  }

  // 2. Dish lookup -> 404
  const existing = getRow(dishId);
  if (!existing) {
    throw fail(404, 'NOT_FOUND', `Dish ${dishId} not found`);
  }

  // 3. Publish rules -> 400 (only when publishing)
  const trimmedName = dishName.trim();
  if (isPublished) {
    if (trimmedName === '') {
      throw fail(400, 'VALIDATION_ERROR', 'A published dish must have a name');
    }
    if (!isValidImageUrl(existing.image_url)) {
      throw fail(400, 'VALIDATION_ERROR', 'Cannot publish: the dish image URL is not a valid http(s) URL');
    }
  }

  // 4. Atomic version-checked update.
  // "AND version = ?" is checked by the database in the same statement as the write,
  // so two users saving at the same time can't both win (no read-then-compare in JS).
  const result = db
    .prepare(
      `UPDATE dishes
       SET dish_name = ?, is_published = ?, version = version + 1
       WHERE dish_id = ? AND version = ?`
    )
    .run(trimmedName, isPublished ? 1 : 0, dishId, expectedVersion);

  if (result.changes === 0) {
    // Someone else changed it first: nothing was written, return the current dish
    throw fail(409, 'VERSION_CONFLICT', 'Dish was updated by someone else', toDish(getRow(dishId)));
  }

  return toDish(getRow(dishId));
}

module.exports = { getAllDishes, updateDish };

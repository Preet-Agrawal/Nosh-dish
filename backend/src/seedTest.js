const seedFromFile = require('./seed');

// Adds one extra dish with an invalid image URL, only for testing publish rules
seedFromFile('test-seed.json');

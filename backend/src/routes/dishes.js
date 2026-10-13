const express = require('express');
const { getAllDishes, updateDish } = require('../services/dishService');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    res.json(getAllDishes());
  } catch (err) {
    next(err);
  }
});

router.patch('/:dishId', (req, res, next) => {
  try {
    res.json(updateDish(req.params.dishId, req.body));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dishesRouter = require('./routes/dishes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/dishes', dishesRouter);

// One error handler gives every error the same JSON format
app.use((err, req, res, next) => {
  // Bad JSON body from express.json() is a client mistake -> 400
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' });
  }
  if (err.status && err.error) {
    const body = { error: err.error, message: err.message };
    if (err.currentDish) body.currentDish = err.currentDish;
    return res.status(err.status).json(body);
  }
  console.error(err);
  res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));

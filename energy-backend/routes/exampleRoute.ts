import express from 'express';
const router = express.Router();

// Add routes here
router.get('/', (req, res) => {
  res.send('Hello World!');
});

export default router;

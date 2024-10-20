import express from 'express';

const router = express.Router();

router.get('/buyingPrice', async (req, res) => {
  try {
    // Get retailer selling price model
    const { SellingPrice } = req.app.get('models');

    // Find the latest retailer selling price
    const result = await SellingPrice.findOne({
      order: [['date', 'DESC']],
    });

    // If no selling price is found, return 404
    if (!result) {
      return res.status(404).send({
        error: 'No buying price found',
      });
    }

    // Return the latest retailer selling price along with the date
    return res.status(200).send({
      date: result.date,
      amount: Number(result.amount),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      error: 'Something went wrong. Please try again later.',
    });
  }
});

export default router;

import express from 'express';
import { isValidId, validateDateInputs } from '../utils/utils';
import { getSpending } from '../utils/dbUtils';

const router = express.Router();

interface Energy {
  date: string;
  amount: number;
}

interface Price {
  date: string;
  amount: number;
}

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

/**
 * GET /consumer/spending
 *
 * Calls getSpending function to obtain the amount the consumer spent on energy in a period of time.
 *
 * Query parameters:
 * - start_date: The start date of the period to retrieve data for, in ISO format
 * - end_date: The end date of the period to retrieve data for, in ISO format (optional)
 * - consumer_id: The ID of the consumer (optional)
 *
 * Response format:
 * {
 *   start_date: string,
 *   end_date: string,
 *   consumer_id: number
 *   values: [
 *     {
 *         date: string,
 *        amount: number
 *     }
 *   ]
 * }
 *
 * Example response:
 * {
 *   start_date: '2024-01-01T00:00:00.000Z',
 *   end_date: '2024-01-02T00:00:00.000Z',
 *   consumer_id: 1
 *   spending: [
 *     {
 *        date: '2024-01-01T00:00:00.000Z',
 *        amount: 300
 *     }
 *   ]
 * }
 */
router.get('/spending', async (req, res) => {
  const { consumer_id, start_date, end_date } = req.query;
  const models = req.app.get('models');

  // Check if consumer_id is an integer
  if (consumer_id && !isValidId(Number(consumer_id))) {
    return res.status(400).send('Consumer ID must be an integer');
  }

  const { data: dates, error: dateError } = validateDateInputs(
    String(start_date),
    String(end_date)
  );

  if (dateError) {
    return res.status(dateError.status).json({
      error: dateError.message,
    });
  }

  const spending = await getSpending(
    models,
    dates.startDate,
    dates.endDate,
    Number(consumer_id)
  );

  return res.status(200).send({
    start_date,
    end_date,
    ...(consumer_id && { consumer_id: Number(consumer_id) }),
    spending,
  });
});

export default router;

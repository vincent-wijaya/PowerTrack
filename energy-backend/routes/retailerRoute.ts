import express from 'express';
import { Op } from 'sequelize';

const router = express.Router();

router.get('/map', async (req, res) => {
  // Retrieve the last energy consumption record (kW) of each suburb. Optionally limit the area of the map to the bounding box defined by 2 coordinate points (top-left and bottom-right).
  const {lat1, long1, lat2, long2} = req.query;
  let whereClause;

  // Get relevant suburbs
  if (lat1 && long1 && lat2 && long2) {
    whereClause = {
      latitude: {
        [Op.between]: [lat1, lat2]
      },
      longitude: {
        [Op.between]: [long1, long2]
      }
    };
  } else {
    whereClause = {};
  }

  // Get all suburbs within the bounding box
  let suburbs = await req.app.get("models").Suburb.findAll({
    where: whereClause,
  });
  console.log(`Suburbs: ${suburbs}`);

  // Get the latest timestamp for each suburb
  let latestConsumptions = await req.app.get("models").sequelize.query(`
    SELECT * FROM (
      SELECT 
        *, 
        ROW_NUMBER() OVER (PARTITION BY suburb_id ORDER BY date DESC) AS rn
      FROM 
        suburb_consumption
      WHERE 
        suburb_id IN (:suburbIds)
    ) AS latest
    WHERE rn = 1;
  `, {
    replacements: { suburbIds: suburbs.map((suburb: any) => suburb.id) },
    type: req.app.get("models").sequelize.QueryTypes.SELECT
  });

  // Return the energy consumption for each suburb
  res.status(200).send({
    energy: latestConsumptions.map((consumption: any) => {
      return {
        suburb_id: consumption.suburb_id,
        consumption: consumption.amount,
        timestamp: latestConsumptions[0].date,
      };
    }),
  });
});


router.get('/consumption', async (req, res) => {
  // Retrieve energy consumption for a suburb or consumer over a period of time
  const {suburb_id, consumer_id, start_date, end_date} = req.query;
  const { sequelize, SuburbConsumption, ConsumerConsumption } = req.app.get('models');

  let date_where_clause;
  if (start_date !== undefined && end_date !== undefined) {
    date_where_clause = {
      [Op.between]: [new Date(String(start_date)), new Date(String(end_date))]
    };
  } else if (start_date !== undefined) {
    date_where_clause = {
      [Op.gte]: new Date(String(start_date))
    };
  } else if (end_date !== undefined) {
    date_where_clause = {
      [Op.lte]: new Date(String(end_date))
    };
  } else {
    date_where_clause = {
      [Op.ne]: null
    };
  }

  let consumptions;

  if (suburb_id && consumer_id) {
    return res.status(400).send("Cannot specify both suburb_id and consumer_id");
  }
  else if (suburb_id) {
    consumptions = await SuburbConsumption.findAll({
      where: {
        suburb_id: suburb_id,
        date: date_where_clause
      }
    });
  } else if (consumer_id) {
    consumptions = await ConsumerConsumption.findAll({
      where: {
        consumer_id: consumer_id,
        date: date_where_clause
      }
    });
  } else {
    // Return nation-wide totals
    consumptions = await SuburbConsumption.findAll({
      attributes: [
        'suburb_id',
        [sequelize.fn('SUM', sequelize.col('amount')), 'amount'],
      ],
      where: {
        date: {
          [Op.between]: [
            start_date ? new Date(String(start_date)) : new Date('1970-01-01T00:00:00Z'),
            end_date ? new Date(String(end_date)) : new Date('9999-01-01T00:00:00Z'),
          ],
        },
      },
      group: ['suburb_id'],
    });
    consumptions = consumptions.map((x: any) => {
        return {
          suburb_id: x.suburb_id,
          start_date: start_date,
          end_date: end_date,
          amount: x.amount
        };
      }
    );
  }
  res.send({
    energy: consumptions
  });
});

router.get('/profit-margin', async (req, res) => {
  const { suburb_id, consumer_id, start_date, end_date } = req.query;
  // const { sequelize, SuburbConsumption, ConsumerConsumption } = req.app.get('models');
});

export default router;

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


router.get('/warnings', async (req, res) => {
  // Retrieve warnings for a suburb
  const {suburb_id, consumer_id} = req.query;
  const { Consumer, ConsumerConsumption, GoalType, WarningType } = req.app.get('models');

  // Get goal types
  const goalTarget: string = consumer_id ? 'consumer' : 'retailer';
  const goalTypes = await GoalType.findAll({
    where: {
      target_type: goalTarget
    }
  });
  if (goalTypes.length === 0) {
    return res.status(501).send("No goal types found");
  }

  // Get warning types
  const warningTypes = await Promise.all(
    goalTypes.map(async (goalType: any) => {
      return await goalType.getWarning_types();
    })
  ).then((result) => result.flat());
  if (warningTypes.length === 0) {
    return res.status(501).send("No warning types found");
  }

  // Iterate through each warning type
  let warnings: any[] = [];
  for (const warningType of warningTypes) {
    switch (warningType.category) {
      // Add a case for each warning type
      // Check for each type of warning whether the warning should be triggered
      // If triggered, add the warning data to the warnings array
      case 'outage_hp':
        // Get high priority consumers
        const whereClause: any = {
          where: {
            high_priority: true
          }
        };
        if (suburb_id) {
          whereClause.where.suburb_id = suburb_id;
        }
        const consumers = await Consumer.findAll(whereClause);
        
        // Check if any of the high priority consumers have an outage
        // Check if their last consumption data is 0
        for (const consumer of consumers) {
          const consumption = await ConsumerConsumption.findOne({
            where: {
              consumer_id: consumer.id
            },
            order: [['date', 'DESC']]
          });
          if (consumption && Number(consumption.amount) === 0) {
            warnings.push({
              category: warningType.category,
              description: warningType.description,
              data: {
                consumer_id: Number(consumer.id),
                street_address: consumer.street_address,
              },
              suggestion: `Prioritise re-establishing energy for priority consumer at address ${consumer.street_address}.`
            });
          }
        }
        break;
      default:
        console.log(`Unsupported warning category: ${warningType.category}`);
    }
  }

  res.send({
    warnings: warnings
  });
})


router.get('/consumers', async (req, res) => {
  // Retrieve consumers by suburb_id or consumer by consumer_id or all consumers
  const { suburb_id, consumer_id } = req.query;
  const { Consumer, Suburb } = req.app.get('models');

  let consumers;

  if (suburb_id && consumer_id) {
    return res.status(400).send("Cannot specify both suburb_id and consumer_id");
  } else if (suburb_id) {
    // Return consumers by suburb_id
    consumers = await Consumer.findAll({
      where: {
        suburb_id: suburb_id,
      },
      include: [{
        model: Suburb,
        attributes: ['name', 'postcode'] // Include name and post_code attributes
      }]
    });
  } else if (consumer_id) {
    // Return specific consumer
    consumers = await Consumer.findAll({
      where: {
        id: consumer_id,
      },
      include: [{
        model: Suburb,
        attributes: ['name', 'postcode'] // Include name and post_code attributes
      }]
    });
  } else {
    // Return all consumers
    consumers = await Consumer.findAll({
      include: [{
        model: Suburb,
        attributes: ['name', 'postcode'] // Include name and post_code attributes
      }]
    });
  }

  // Transform response to the desired format
  const formattedConsumers = consumers.map((consumer:any) => {
    return{
    id: consumer.id,
    high_priority: consumer.high_priority,
    address: consumer.street_address,
    suburb_id: consumer.suburb_id,
    suburb_name: consumer.suburb.name,
    suburb_post_code: consumer.suburb.postcode
    }
    
  });

  res.send({
    consumers: formattedConsumers
  });
});



router.get('/suburbs', async (req, res) => {
  const { sequelize, Suburb } = req.app.get('models');

  try {
    const suburbs = await Suburb.findAll();
    res.send({
      suburbs: suburbs
    });
  } catch (error) {
    res.status(500).send({
      error: 'An error occurred while fetching suburbs'
    });
  }
});



export default router;

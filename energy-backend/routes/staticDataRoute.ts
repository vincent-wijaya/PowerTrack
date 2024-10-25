import express from 'express';

import { defineModels } from '../databaseModels';

const router = express.Router();

type DbModelType = ReturnType<typeof defineModels>;

router.get('/consumers', async (req, res) => {
  // Retrieve consumers by suburb_id or consumer by consumer_id or all consumers
  const { suburb_id, consumer_id } = req.query;
  const { Consumer, Suburb } = req.app.get('models');

  let consumers;

  if (suburb_id && consumer_id) {
    return res
      .status(400)
      .send('Cannot specify both suburb_id and consumer_id');
  } else if (suburb_id) {
    // Return consumers by suburb_id
    consumers = await Consumer.findAll({
      where: {
        suburb_id: suburb_id,
      },
      include: [
        {
          model: Suburb,
          attributes: ['name', 'postcode'], // Include name and post_code attributes
        },
      ],
    });
  } else if (consumer_id) {
    // Return specific consumer
    consumers = await Consumer.findAll({
      where: {
        id: consumer_id,
      },
      include: [
        {
          model: Suburb,
          attributes: ['name', 'postcode'], // Include name and post_code attributes
        },
      ],
    });
  } else {
    // Return all consumers
    consumers = await Consumer.findAll({
      include: [
        {
          model: Suburb,
          attributes: ['name', 'postcode'], // Include name and post_code attributes
        },
      ],
    });
  }

  // Transform response to the desired format

  const formattedConsumers = consumers.map((consumer: any) => {
    return {
      id: consumer.id,
      high_priority: consumer.high_priority,
      address: consumer.street_address,
      suburb_id: consumer.suburb_id,
      suburb_name: consumer.suburb.name,
      suburb_post_code: consumer.suburb.postcode,
    };
  });

  res.send({
    consumers: formattedConsumers,
  });
});

router.get('/suburbs', async (req, res) => {
  const { sequelize, Suburb } = req.app.get('models');

  try {
    const suburbs = await Suburb.findAll();
    res.send({
      suburbs: suburbs,
    });
  } catch (error) {
    res.status(500).send({
      error: 'An error occurred while fetching suburbs',
    });
  }
});

router.get('/suburbs/:id', async (req, res) => {
  const { sequelize, Suburb, Consumer } = req.app.get('models') as DbModelType;
  const id = req.params.id;
  try {
    const suburb = await Suburb.findOne({ where: { id: id } });
    if (!suburb) {
      return res.status(404).send('Suburb not found');
    }
    const consumerCounts = (await Consumer.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('consumer.id')), 'count'],
        'consumer.high_priority',
      ],
      include: [
        {
          model: Suburb,
          attributes: [],
          where: { id: id },
        },
      ],
      group: ['consumer.high_priority'],
      raw: true,
    })) as unknown as { count: string; high_priority: boolean }[];
    const highPriorityCount = parseInt(
      consumerCounts.find((c) => c.high_priority)?.count || '0'
    );
    const lowPriorityCount = parseInt(
      consumerCounts.find((c) => !c.high_priority)?.count || '0'
    );
    res.send({
      id: suburb.id,
      name: suburb.name,
      postcode: suburb.postcode,
      state: suburb.state,
      highPriorityConsumers: highPriorityCount,
      lowPriorityConsumers: lowPriorityCount,
    });
  } catch (error) {
    res.status(500).send({
      error: 'An error occurred while fetching suburbs',
    });
  }
});

export default router;

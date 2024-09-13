import {
  ForeignKeyConstraintError,
  Sequelize,
  UniqueConstraintError,
} from 'sequelize';
import { Kafka, KafkaMessage } from 'kafkajs';
import { defineModels } from './databaseModels';
const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID!,
  brokers: [process.env.LOCAL_BROKER_IP!],
});
export class NullKafkaMessageError extends Error {}
export class KafkaMessageError extends Error {}

/* istanbul ignore next */
function handleErrorMessages(error: any) {
  if (error instanceof SyntaxError) {
    console.error('Could not parse message body');
  } else if (error instanceof NullKafkaMessageError) {
    console.error('Kafka message contained null elements');
  } else if (error instanceof UniqueConstraintError) {
    console.error('Entry with that timestamp already exists');
  } else {
    console.error('Unknown error occurred');
  }
}

/**
 * Reads a raw kafka message and parses outkey elements
 * @param message The raw kafka message to parse
 * @returns The key, data and timestamp of the message
 */
function parseMessage(message: KafkaMessage) {
  if (!message || !message.key || !message.value) {
    throw new KafkaMessageError('Message contained a null key or value');
  }
  const key = Number.parseInt(message.key.toString());
  const value = JSON.parse(message.value.toString());
  const parsedMessage = { key, time: new Date(value.date), value: value.value };
  if (isNaN(parsedMessage.key)) {
    throw new KafkaMessageError(`Message key was not a number`);
  }
  if (isNaN(parsedMessage.time.getTime())) {
    throw new KafkaMessageError('Message timestamp was not a date');
  }
  return parsedMessage;
}
/**
 * Inserts a suburb consumption message into the relevent table
 *
 * Gracefully handles any error
 *
 * @param suburbConsumption The model to used when updating the database
 * @param message The message to read and insert
 */
async function readSuburbMessages(
  suburbConsumption: any,
  message: KafkaMessage
) {
  try {
    let data = parseMessage(message);

    await suburbConsumption.create({
      suburb_id: data.key,
      date: data.time,
      amount: data.value,
    });
    console.info(`Created consumption entry for suburb ${data.key}`);
  } catch (error) {
    if (error instanceof ForeignKeyConstraintError) {
      // Tried to add consumption to a non-existent suburb
      console.error('Could not add consumption event to non-existant suburb');
    } else {
      handleErrorMessages(error);
    }
    console.log('Skipping message');
  }
}
/**
 * Inserts a generator production message into the relevent table
 *
 * Gracefully handles any error
 *
 * @param energyGeneration The model to used when updating the database
 * @param message The message to read and insert
 */
async function readGeneratorMessages(
  energyGeneration: any,
  message: KafkaMessage
) {
  try {
    let data = parseMessage(message);

    await energyGeneration.create({
      energy_generator_id: data.key,
      date: data.time,
      amount: data.value,
    });
    console.info(`Created production entry for generator ${data.key}`);
  } catch (error) {
    if (error instanceof ForeignKeyConstraintError) {
      console.error('Could not add generation event to non-existant generator');
    } else {
      handleErrorMessages(error);
    }
    console.log('Skipping message', message);
  }
}

/**
 * Inserts a consumer consumption message into the relevent table
 *
 * Gracefully handles any error
 *
 * @param consumerConsumption The model to used when updating the database
 * @param message The message to read and insert
 */
async function readConsumerMessages(
  consumerConsumption: any,
  message: KafkaMessage
) {
  try {
    let data = parseMessage(message);
    await consumerConsumption.create({
      consumer_id: data.key,
      date: data.time,
      amount: data.value,
    });
    console.info(`Created consumption entry for consumer ${data.key}`);
  } catch (error) {
    if (error instanceof ForeignKeyConstraintError) {
      console.error('Could not add consumption event to non-existant consumer');
    } else {
      handleErrorMessages(error);
    }
    console.log('Skipping message', message);
  }
}

/**
 * Inserts a spot price message into the database
 *
 * Gracefully handles any error
 * @param spotPrice The model to used when updating the database
 * @param message The spot price message from kafka
 */
async function readSpotPriceMessages(spotPrice: any, message: KafkaMessage) {
  try {
    let data = parseMessage(message);
    await spotPrice.create({
      date: data.time,
      amount: data.value,
    });
  } catch (error) {
    handleErrorMessages(error);
    console.log('Skipping message', message);
  }
}
/**
 * Inserts a selling price message into the database
 *
 * Gracefully handles any error
 * @param sellingPrice The model to used when updating the database
 * @param message The selling price message from kafka
 */
async function readSellingPriceMessages(
  sellingPrice: any,
  message: KafkaMessage
) {
  try {
    let data = parseMessage(message);
    await sellingPrice.create({
      date: data.time,
      amount: data.value,
    });
  } catch (error) {
    handleErrorMessages(error);
    console.log('Skipping message', message);
  }
}

/* istanbul ignore next: don't test kafka library*/
/**
 * Setup consumers for each of the 5 kafka topics
 * Uses a given sequelize object in order to connect to the database
 *
 * @param models The models used by each listener to interface with the database
 */
async function importEvents(models: {
  SpotPrice: any;
  SellingPrice: any;
  ConsumerConsumption: any;
  SuburbConsumption: any;
  EnergyGeneration: any;
}) {
  // Setup consumer for energy generation events
  const generatorConsumer = kafka.consumer({ groupId: 'generatorReaders' });
  await generatorConsumer
    .connect()
    .then(() =>
      generatorConsumer.subscribe({ topics: ['generatorProduction'] })
    );
  generatorConsumer.run({
    eachMessage: async ({ message }) => {
      readGeneratorMessages(models.EnergyGeneration, message);
    },
  }); //dont await to avoid blocking

  // Setup consumer for suburb consumption events
  const suburbConsumer = kafka.consumer({ groupId: 'suburbReaders' });
  await suburbConsumer
    .connect()
    .then(() => suburbConsumer.subscribe({ topics: ['suburbConsumption'] }));
  suburbConsumer.run({
    eachMessage: async ({ message }) =>
      readSuburbMessages(models.SuburbConsumption, message),
  }); //dont await to avoid blocking

  // Setup consumer for consumer consumption events (i know its a confusing name)
  const consumerConsumer = kafka.consumer({ groupId: 'consumerReaders' });
  await consumerConsumer
    .connect()
    .then(() =>
      consumerConsumer.subscribe({ topics: ['consumerConsumption'] })
    );
  consumerConsumer.run({
    eachMessage: async ({ message }) =>
      readConsumerMessages(models.ConsumerConsumption, message),
  }); //dont await to avoid blocking

  // Setup consumer for spot price events
  const spotPriceConsumer = kafka.consumer({ groupId: 'spotPriceReaders' });
  await spotPriceConsumer
    .connect()
    .then(() => spotPriceConsumer.subscribe({ topics: ['spotPrice'] }));
  spotPriceConsumer.run({
    eachMessage: async ({ message }) =>
      readSpotPriceMessages(models.SpotPrice, message),
  }); //dont await to avoid blocking

  // Setup consumer for selling price events
  const sellingPriceConsumer = kafka.consumer({
    groupId: 'sellingPriceReaders',
  });
  await sellingPriceConsumer
    .connect()
    .then(() => sellingPriceConsumer.subscribe({ topics: ['sellingPrice'] }));
  sellingPriceConsumer.run({
    eachMessage: async ({ message }) =>
      readSellingPriceMessages(models.SellingPrice, message),
  }); //dont await to avoid blocking
}

/* istanbul ignore next: we dont test the setup */
if (require.main === module) {
  const sequelize = new Sequelize(process.env.DATABASE_URI!, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false, //remove excess logging
    define: { timestamps: false }, // remove created and updated timestamps from models
    dialectOptions: {},
  });

  // Execute the following if this file is run from the command line
  const models = defineModels(sequelize); //setup the database
  importEvents(models); // start importing events
}

// Only export these functions if the node enviornment is set to testing
export let exportsForTesting: {
  readSuburbMessages: (model: any, message: KafkaMessage) => Promise<void>;
  readSpotPriceMessages: (model: any, message: KafkaMessage) => Promise<void>;
  readSellingPriceMessages: (
    model: any,
    message: KafkaMessage
  ) => Promise<void>;
  readConsumerMessages: (model: any, message: KafkaMessage) => Promise<void>;
  readGeneratorMessages: (model: any, message: KafkaMessage) => Promise<void>;
  parseMessage: (message: KafkaMessage) => void;
};
if (process.env.NODE_ENV === 'test') {
  exportsForTesting = {
    parseMessage,
    readSuburbMessages,
    readConsumerMessages,
    readGeneratorMessages,
    readSpotPriceMessages,
    readSellingPriceMessages,
  };
}

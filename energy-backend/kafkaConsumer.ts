import { ForeignKeyConstraintError } from 'sequelize';
import { ConsumerConsumption, EnergyGeneration, SellingPrice, SpotPrice, SuburbConsumption } from './databaseModels';
import { Kafka, KafkaMessage } from 'kafkajs';

const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID!,
    brokers: [process.env.LOCAL_BROKER_IP!]
})

/**
 * Inserts a suburb consumption message into the relevent table
 * 
 * Critically fails if the message has a null key or value
 * Gracefully fails if the suburb entry does not exist
 * @param message The message to read and insert
 */
async function readSuburbMessages(message: KafkaMessage) {
    if (!message.key || !message.value) {
        throw new Error("Message contained a null key or value")
    }
    const key = Number.parseInt(message.key.toString())
    const value = Number.parseInt(message.value.toString())
    const timestamp = new Date(Number.parseInt(message.timestamp) * 1000)
    try {
        await SuburbConsumption.create({
            "suburb_id": key,
            "date": timestamp,
            "amount": value
        })
        console.info(`Created consumption entry for suburb ${key}`)
    } catch (error) {
        if (error instanceof ForeignKeyConstraintError) {
            // Tried to add consumption to a non-existent suburb
            console.error(`Could not add consumption event to suburb ${key}`)
        } else {
            throw error; //pass the error on up
        }
    }
}
/**
 * Inserts a generator production message into the relevent table
 * 
 * Critically fails if the message has a null key or value
 * Gracefully fails if the generator entry does not exist
 * @param message The message to read and insert
 */
async function readGeneratorMessages(message: KafkaMessage) {
    if (!message.key || !message.value) {
        throw new Error("Message contained a null key or value")
    }
    const key = Number.parseInt(message.key.toString())
    const value = Number.parseInt(message.value.toString())
    const timestamp = new Date(Number.parseInt(message.timestamp) * 1000)
    try {
        await EnergyGeneration.create({
            "energy_generator_id": key,
            "date": timestamp,
            "amount": value
        })
        console.info(`Created production entry for generator ${key}`)
    } catch (error) {
        if (error instanceof ForeignKeyConstraintError) {
            // Tried to add consumption to a non-existent generator
            console.error(`Could not add consumption event to generator ${key}`)
        } else {
            throw error; //pass the error on up
        }
    }
}


/**
 * Inserts a consumer consumption message into the relevent table
 * 
 * Critically fails if the message has a null key or value
 * Gracefully fails if the consumer entry does not exist
 * @param message The message to read and insert
 */
async function readConsumerMessages(message: KafkaMessage) {
    if (!message.key || !message.value) {
        throw new Error("Message contained a null key or value")
    }
    const key = Number.parseInt(message.key.toString())
    const value = Number.parseInt(message.value.toString())
    const timestamp = new Date(Number.parseInt(message.timestamp) * 1000)
    try {
        await ConsumerConsumption.create({
            "consumer_id": key,
            "date": timestamp,
            "amount": value
        })
        console.info(`Created production entry for consumer ${key}`)
    } catch (error) {
        if (error instanceof ForeignKeyConstraintError) {
            // Tried to add consumption to a non-existent generator
            console.error(`Could not add consumption event to consumer ${key}`)
        } else {
            throw error; //pass the error on up
        }
    }
}

/**
 * Inserts a spot price message into the database
 * 
 * Critically fails if the message has a null key or value
 * Does not handle any errors from writing data into the database
 * @param message The spot price message from kafka
 */
async function readSpotPriceMessages(message: KafkaMessage) {
    if (!message.key || !message.value) {
        throw new Error("Message contained a null key or value")
    }
    const timestamp = new Date(Number.parseInt(message.key.toString()) * 1000)
    const value = Number.parseInt(message.value.toString())

    await SpotPrice.create({
        date: timestamp,
        amount: value
    })
}
/**
 * Inserts a selling price message into the database
 * 
 * Critically fails if the message has a null key or value
 * Does not handle any errors from writing data into the database
 * @param message The selling price message from kafka
 */
async function readSellingPriceMessages(message: KafkaMessage) {
    if (!message.key || !message.value) {
        throw new Error("Message contained a null key or value")
    }
    const timestamp = new Date(Number.parseInt(message.key.toString()) * 1000)
    const value = Number.parseInt(message.value.toString())

    await SellingPrice.create({
        date: timestamp,
        amount: value
    })
}

async function importEvents() {

    // Setup consumer for energy generation events
    const generatorConsumer = kafka.consumer({ groupId: 'generatorReaders' })
    await generatorConsumer.connect()
        .then(() => generatorConsumer.subscribe({ topics: ["generatorProduction"] }))
    generatorConsumer.run({ eachMessage: async ({ message }) => { readGeneratorMessages(message) }, }) //dont await to avoid blocking

    // Setup consumer for suburb consumption events
    const suburbConsumer = kafka.consumer({ groupId: 'suburbReaders' })
    await suburbConsumer.connect()
        .then(() => suburbConsumer.subscribe({ topics: ["suburbConsumption"] }))
    suburbConsumer.run({ eachMessage: async ({ message }) => readSuburbMessages(message), }) //dont await to avoid blocking

    // Setup consumer for consumer consumption events (i know its a confusing name)
    const consumerConsumer = kafka.consumer({ groupId: 'consumerReaders' })
    await consumerConsumer.connect()
        .then(() => consumerConsumer.subscribe({ topics: ["consumerConsumption"] }))
    consumerConsumer.run({ eachMessage: async ({ message }) => readConsumerMessages(message) }) //dont await to avoid blocking

    // Setup consumer for spot price events
    const spotPriceConsumer = kafka.consumer({ groupId: 'spotPriceReaders' })
    await spotPriceConsumer.connect()
        .then(() => spotPriceConsumer.subscribe({ topics: ["spotPrice"] }))
    spotPriceConsumer.run({ eachMessage: async ({ message }) => readSpotPriceMessages(message) }) //dont await to avoid blocking

    // Setup consumer for selling price events 
    const sellingPriceConsumer = kafka.consumer({ groupId: 'sellingPriceReaders' })
    await sellingPriceConsumer.connect()
        .then(() => sellingPriceConsumer.subscribe({ topics: ["sellingPrice"] }))
    sellingPriceConsumer.run({ eachMessage: async ({ message }) => readSellingPriceMessages(message) }) //dont await to avoid blocking
}

importEvents()
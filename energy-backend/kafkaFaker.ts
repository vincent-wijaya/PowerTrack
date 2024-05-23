import { ForeignKeyConstraintError, Sequelize } from 'sequelize';
import setupDatabase from './setup_database';
import { Kafka } from 'kafkajs';
import { defineModels } from './databaseModels';
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
async function readSuburbMessages(sequelize: Sequelize, message: KafkaMessage) {
    if (!message.key || !message.value) {
        throw new Error("Message contained a null key or value")
    }
    try {
        await sequelize.models.suburb_consumption.create({
            suburb_id: message.key,
            date: message.timestamp,
            amount: message.value
        })
        console.info(`Created consumption entry for suburb ${message.key}`)
    } catch (error) {
        if (error instanceof ForeignKeyConstraintError) {
            // Tried to add consumption to a non-existent suburb
            console.error(`Could not add consumption event to suburb ${message.key}`)
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
async function readGeneratorMessages(sequelize: Sequelize, message: KafkaMessage) {
    if (!message.key || !message.value) {
        throw new Error("Message contained a null key or value")
    }
    try {
        await sequelize.models.energy_generation.create({
            energy_generator_id: message.key,
            date: message.timestamp,
            amount: message.value
        })
        console.info(`Created production entry for generator ${message.key}`)
    } catch (error) {
        if (error instanceof ForeignKeyConstraintError) {
            // Tried to add consumption to a non-existent generator
            console.error(`Could not add consumption event to generator ${message.key}`)
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
async function readConsumerMessages(sequelize: Sequelize, message: KafkaMessage) {
    if (message.key === null || message.value === null) {
        throw new Error("Message contained a null key or value")
    }
    try {
        await sequelize.models.consumer_consumption.create({
            consumer_id: message.key,
            date: message.timestamp,
            amount: message.value
        })
        console.info(`Created consumption entry for consumer ${message.key}`)
    } catch (error) {
        if (error instanceof ForeignKeyConstraintError) {
            // Tried to add consumption to a non-existent generator
            console.error(`Could not add consumption event to consumer ${message.key}`)
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
async function readSpotPriceMessages(sequelize: Sequelize, message: KafkaMessage) {
    if (!message.key || !message.value) {
        throw new Error("Message contained a null key or value")
    }
    await sequelize.models.spot_price.create({
        date: message.timestamp,
        amount: message.value
    })
    console.info(`Created spot price entry`)
}
/**
 * Inserts a selling price message into the database
 * 
 * Critically fails if the message has a null key or value
 * Does not handle any errors from writing data into the database
 * @param message The selling price message from kafka
 */
async function readSellingPriceMessages(sequelize: Sequelize, message: KafkaMessage) {
    if (!message.key || !message.value) {
        throw new Error("Message contained a null key or value")
    }

    await sequelize.models.selling_price.create({
        date: message.timestamp,
        amount: message.value
    })
    console.info(`Created selling price entry`)
}

/**
 * Generates a random number between the min and max
 * 
 * @param min 
 * @param max 
 * @returns random number between the min and the max
 */
function randBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
}

/**
 * Creates a list of kafka messages with a random number value and sequential keys
 * Config determines the number of messages, and the range for the random value
 *
 * @param config Options to define messages to send
 */
function mockData(config: MockerConfig): KafkaMessage[] {
    return config.entities.map((entity) =>
    ({
        key: entity,
        value: randBetween(config.min, config.max),
        timestamp: new Date(),
    }))
}

function mockPrice(config: PriceConfig): KafkaMessage {
    return {
        key: 1, // The current time as a UNIX timestamp
        value: randBetween(config.min, config.max),
        timestamp: new Date(),
    } //Random number according to config
}

type KafkaMessage = {
    key: number,
    value: number,
    timestamp: Date
}

type PriceConfig = {
    max: number,
    min: number
}

type MockerConfig = {
    entities: number[],
    max: number,
    min: number
}

const suburbConfig = { entities: [20457, 20456, 20455, 20454, 20453], max: 1000, min: 500 }
const consumerConfig = { entities: [1, 2, 3, 4, 5], max: 300, min: 0 }
const generatorConfig = { entities: [1, 2, 3, 4, 5], max: 5000, min: 2000 }
const spotPriceConfig = { min: 10, max: 100 }
const sellingPriceConfig = { min: 30, max: 130 }
const config = {
    interval: 4000,
    topics: [
        "suburbConsumption",
        "consumerConsumption",
        "generatorProduction",
        "spotPrice",
        "sellingPrice"
    ]
}

function fakeMessages(sequelize: Sequelize) {
    // Setup consumer for energy generation events
    setInterval(() => {
        mockData(generatorConfig).forEach(message => readGeneratorMessages(sequelize, message))
    }, 10000)
    setInterval(() => {
        mockData(suburbConfig).forEach(message => readSuburbMessages(sequelize, message))
    }, 10000)
    setInterval(() => {
        mockData(consumerConfig).forEach(message => readConsumerMessages(sequelize, message))
    }, 10000)
    setInterval(() => {
        readSpotPriceMessages(sequelize, mockPrice(spotPriceConfig))
    }, 10000)
    setInterval(() => {
        readSellingPriceMessages(sequelize, mockPrice(sellingPriceConfig))
    }, 10000)
    console.log("Setup entries")
}

if (require.main === module) {
    // Execute the following if this file is run from the command line
    const sequelize = new Sequelize("postgres://postgres:password@localhost:5432/retailerEnergy",
        {
            dialect: 'postgres',
            protocol: 'postgres',
            define: { timestamps: false }, // remove created and updated timestamps from models
            dialectOptions: {}
        })

    defineModels(sequelize) //setup the database
    fakeMessages(sequelize)
}
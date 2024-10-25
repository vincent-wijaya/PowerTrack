// Set node enviornment to Test
process.env.NODE_ENV = 'test';
import { connectToTestDb, dropTestDb } from './testDb';
import { Sequelize } from 'sequelize';
import { defineModels } from '../databaseModels';
import { KafkaMessage } from 'kafkajs';
import { exportsForTesting, KafkaMessageError } from '../kafkaConsumer';
const {
  parseMessage,
  readSuburbMessages,
  readConsumerMessages,
  readGeneratorMessages,
  readSpotPriceMessages,
  readSellingPriceMessages,
} = exportsForTesting;

const duplicateErrorMsg = 'Entry with that timestamp already exists';

describe('parseMessage', () => {
  let sequelize: Sequelize;
  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    // We have to reset the database to have no data just models
    defineModels(sequelize);
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('Should parse message with no issues', async () => {
    const expectedMessage = {
      key: 1,
      value: 'testValue',
      time: new Date('2024-01-01T01:00:00.000Z'),
    };
    const message = {
      key: Buffer.from(expectedMessage.key.toString()),
      value: Buffer.from(
        JSON.stringify({
          value: expectedMessage.value,
          date: expectedMessage.time.toISOString(),
        })
      ),
    } as KafkaMessage;

    const result = parseMessage(message);

    expect(result).toEqual(expectedMessage);
  });
  it('Should fail to parse JSON', async () => {
    const message = {
      key: Buffer.from('1'),
      value: Buffer.from('invalid json'),
    } as KafkaMessage;
    expect(() => parseMessage(message)).toThrow(SyntaxError);
  });
  it('Should fail to read a null key kafka message', async () => {
    const message = {
      key: null,
      value: Buffer.from('1'),
    } as KafkaMessage;
    expect(() => parseMessage(message)).toThrow(KafkaMessageError);
    expect(() => parseMessage(message)).toThrow(
      'Message contained a null key or value'
    );
  });
  it('Should fail to read a null value kafka message', async () => {
    const message = {
      key: Buffer.from('1'),
      value: null,
    } as KafkaMessage;
    expect(() => parseMessage(message)).toThrow(KafkaMessageError);
    expect(() => parseMessage(message)).toThrow(
      'Message contained a null key or value'
    );
  });

  it('Should fail to read a non-integer key', async () => {
    const message = {
      key: Buffer.from('string'),
      value: Buffer.from(
        JSON.stringify({
          value: 'test',
          date: '2024-01-01T01:00:00.000Z',
        })
      ),
    } as KafkaMessage;
    expect(() => parseMessage(message)).toThrow(KafkaMessageError);
    expect(() => parseMessage(message)).toThrow('Message key was not a number');
  });

  it('Should fail to read a non-date time', async () => {
    const message = {
      key: Buffer.from('1'),
      value: Buffer.from(
        JSON.stringify({
          value: 'test',
          date: 'wrong Date',
        })
      ),
    } as KafkaMessage;
    expect(() => parseMessage(message)).toThrow(KafkaMessageError);
    expect(() => parseMessage(message)).toThrow(
      'Message timestamp was not a date'
    );
  });
});

describe('suburbMessages', () => {
  let sequelize: Sequelize;
  let SuburbConsumption: any;
  let loggerSpy: jest.SpyInstance;
  beforeAll(async () => {
    loggerSpy = jest.spyOn(console, 'error');
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    // We have to reset the database to have no data just models
    let models = defineModels(sequelize);
    await sequelize.sync({ force: true });
    SuburbConsumption = models.SuburbConsumption;
    await models.Suburb.create({
      id: 0,
      name: 'Test Suburb',
      postcode: 1111,
      state: 'vic',
      latitude: '1.1',
      longitude: '11.1',
    });
  });

  //clear the logger spy after each test
  afterEach(async () => {
    loggerSpy.mockClear();
  });

  afterAll(async () => {
    loggerSpy.mockRestore();
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('Should insert with no issues', async () => {
    const expectedMessage = {
      key: 0,
      value: 100,
      time: new Date('2024-01-01T01:00:00.000Z'),
    };
    const message = {
      key: Buffer.from(expectedMessage.key.toString()),
      value: Buffer.from(
        JSON.stringify({
          value: expectedMessage.value,
          date: expectedMessage.time.toISOString(),
        })
      ),
    } as KafkaMessage;

    await readSuburbMessages(SuburbConsumption, message);

    let tableEntries = await sequelize.query(
      'SELECT * FROM suburb_consumption WHERE suburb_id=0;'
    );
    expect(tableEntries[0].length).toBe(1);
    let entry: any = tableEntries[0][0];
    expect(entry).toMatchObject({
      amount: expectedMessage.value.toString(),
      suburb_id: '0',
    });
    expect(entry.date.toISOString()).toBe(expectedMessage.time.toISOString());
  });

  it('should error but not fail from a missing suburb', async () => {
    const message = {
      key: Buffer.from('1'),
      value: Buffer.from(
        JSON.stringify({
          value: '1',
          date: '2024-01-02T01:00:00.000Z',
        })
      ),
    } as KafkaMessage;

    await readSuburbMessages(SuburbConsumption, message);

    expect(loggerSpy).toHaveBeenCalledWith(
      'Could not add consumption event to non-existant suburb'
    );
  });
  it('should error but not fail from a duplicate date', async () => {
    const message = {
      key: Buffer.from('0'),
      value: Buffer.from(
        JSON.stringify({
          value: '1',
          date: '2024-01-03T01:00:00.000Z',
        })
      ),
    } as KafkaMessage;

    await readSuburbMessages(SuburbConsumption, message);

    await readSuburbMessages(SuburbConsumption, message);

    expect(loggerSpy).toHaveBeenCalledWith(duplicateErrorMsg);
  });
});
describe('consumerMessages', () => {
  let sequelize: Sequelize;
  let ConsumerConsumption: any;
  let loggerSpy: jest.SpyInstance;
  beforeAll(async () => {
    loggerSpy = jest.spyOn(console, 'error');
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    // We have to reset the database to have no data just models
    let models = defineModels(sequelize);
    await sequelize.sync({ force: true });

    ConsumerConsumption = models.ConsumerConsumption;
    await models.Suburb.create({
      id: 0,
      name: 'Test Suburb',
      postcode: 1111,
      state: 'vic',
      latitude: '1.1',
      longitude: '11.1',
    });
    //have to do this because else we can't specify suburb_id
    await (models.Consumer as any).create({
      id: 0,
      suburb_id: 0,
      street_address: '11',
      latitude: -37.79313,
      longitude: 144.975158,
      high_priority: true,
    });
  });

  afterAll(async () => {
    loggerSpy.mockRestore();
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  //clear the logger spy before each test
  afterEach(async () => {
    loggerSpy.mockClear();
  });

  it('Should insert with no issues', async () => {
    const expectedMessage = {
      key: 0,
      value: 100,
      time: new Date('2024-01-01T01:00:00.000Z'),
    };
    const message = {
      key: Buffer.from(expectedMessage.key.toString()),
      value: Buffer.from(
        JSON.stringify({
          value: expectedMessage.value,
          date: expectedMessage.time.toISOString(),
        })
      ),
    } as KafkaMessage;

    await readConsumerMessages(ConsumerConsumption, message);

    let tableEntries = await sequelize.query(
      'SELECT * FROM consumer_consumption WHERE consumer_id=0;'
    );
    expect(tableEntries[0].length).toBe(1);
    let entry: any = tableEntries[0][0];
    expect(entry).toMatchObject({
      amount: expectedMessage.value.toString(),
      consumer_id: 0,
    });
    expect(entry.date.toISOString()).toBe(expectedMessage.time.toISOString());
  });

  it('should error but not fail from a missing consumer', async () => {
    const message = {
      key: Buffer.from('1'),
      value: Buffer.from(
        JSON.stringify({
          value: '1',
          date: '2024-01-02T01:00:00.000Z',
        })
      ),
    } as KafkaMessage;

    await readConsumerMessages(ConsumerConsumption, message);

    expect(loggerSpy).toHaveBeenCalledWith(
      'Could not add consumption event to non-existant consumer'
    );
  });
  it('should error but not fail from a duplicate date', async () => {
    const message = {
      key: Buffer.from('0'),
      value: Buffer.from(
        JSON.stringify({
          value: '1',
          date: '2024-01-03T01:00:00.000Z',
        })
      ),
    } as KafkaMessage;

    await readConsumerMessages(ConsumerConsumption, message);
    await readConsumerMessages(ConsumerConsumption, message);

    expect(loggerSpy).toHaveBeenCalledWith(duplicateErrorMsg);
  });
});
describe('generatorMessages', () => {
  let sequelize: Sequelize;
  let EnergyGeneration: any;

  let loggerSpy: jest.SpyInstance;
  beforeAll(async () => {
    loggerSpy = jest.spyOn(console, 'error');
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    // We have to reset the database to have no data just models
    let models = defineModels(sequelize);
    await sequelize.sync({ force: true });

    EnergyGeneration = models.EnergyGeneration;
    await models.GeneratorType.create({
      id: 0,
      category: 'Test',
      renewable: true,
    });
    await models.Suburb.create({
      id: 0,
      name: 'Test Suburb',
      postcode: 1111,
      state: 'vic',
      latitude: '1.1',
      longitude: '1.1',
    });
    await (models.EnergyGenerator as any).create({
      id: 0,
      name: 'testGenerator',
      generator_type_id: 0,
      suburb_id: 0,
    });
  });

  afterAll(async () => {
    loggerSpy.mockRestore();
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  //clear the logger spy before each test
  afterEach(async () => {
    loggerSpy.mockClear();
  });

  it('Should insert with no issues', async () => {
    const expectedMessage = {
      key: 0,
      value: 100,
      time: new Date('2024-01-01T01:00:00.000Z'),
    };
    const message = {
      key: Buffer.from(expectedMessage.key.toString()),
      value: Buffer.from(
        JSON.stringify({
          value: expectedMessage.value,
          date: expectedMessage.time.toISOString(),
        })
      ),
    } as KafkaMessage;

    await readGeneratorMessages(EnergyGeneration, message);

    let tableEntries = await sequelize.query(
      'SELECT * FROM energy_generation WHERE energy_generator_id=0;'
    );
    expect(tableEntries[0].length).toBe(1);
    let entry: any = tableEntries[0][0];
    expect(entry).toMatchObject({
      amount: expectedMessage.value.toString(),
      energy_generator_id: 0,
    });
    expect(entry.date.toISOString()).toBe(expectedMessage.time.toISOString());
  });

  it('should error but not fail from a missing generator', async () => {
    const message = {
      key: Buffer.from('1'),
      value: Buffer.from(
        JSON.stringify({
          value: '1',
          date: '2024-01-02T01:00:00.000Z',
        })
      ),
    } as KafkaMessage;

    await readGeneratorMessages(EnergyGeneration, message);

    expect(loggerSpy).toHaveBeenCalledWith(
      'Could not add generation event to non-existant generator'
    );
  });
  it('should error but not fail from a duplicate date', async () => {
    const message = {
      key: Buffer.from('0'),
      value: Buffer.from(
        JSON.stringify({
          value: '1',
          date: '2024-01-03T01:00:00.000Z',
        })
      ),
    } as KafkaMessage;

    await readGeneratorMessages(EnergyGeneration, message);
    await readGeneratorMessages(EnergyGeneration, message);

    expect(loggerSpy).toHaveBeenCalledWith(duplicateErrorMsg);
  });
});
describe('spotPriceMessages', () => {
  let sequelize: Sequelize;
  let SpotPrice: any;
  let loggerSpy: jest.SpyInstance;
  beforeAll(async () => {
    loggerSpy = jest.spyOn(console, 'error');
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    // We have to reset the database to have no data just models
    let models = defineModels(sequelize);
    SpotPrice = models.SpotPrice;
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    loggerSpy.mockRestore();
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  //clear the logger spy before each test
  afterEach(async () => {
    loggerSpy.mockClear();
  });
  it('Should insert with no issues', async () => {
    const expectedMessage = {
      key: 0,
      value: 100,
      time: new Date('2024-01-01T01:00:00.000Z'),
    };
    const message = {
      key: Buffer.from(expectedMessage.key.toString()),
      value: Buffer.from(
        JSON.stringify({
          value: expectedMessage.value,
          date: expectedMessage.time.toISOString(),
        })
      ),
    } as KafkaMessage;

    await readSpotPriceMessages(SpotPrice, message);

    let tableEntries = await sequelize.query('SELECT * FROM spot_price;');

    expect(tableEntries[0].length).toBe(1);
    let entry: any = tableEntries[0][0];
    expect(entry).toMatchObject({
      amount: expectedMessage.value.toString(),
    });
    expect(entry.date.toISOString()).toBe(expectedMessage.time.toISOString());
  });

  it('should error but not fail from a duplicate date', async () => {
    const message = {
      key: Buffer.from('0'),
      value: Buffer.from(
        JSON.stringify({
          value: '1',
          date: '2024-01-03T01:00:00.000Z',
        })
      ),
    } as KafkaMessage;

    await readSpotPriceMessages(SpotPrice, message);
    await readSpotPriceMessages(SpotPrice, message);

    expect(loggerSpy).toHaveBeenCalledWith(duplicateErrorMsg);
  });
});
describe('SellingPriceMessages', () => {
  let sequelize: Sequelize;
  let SellingPrice: any;
  let loggerSpy: jest.SpyInstance;
  beforeAll(async () => {
    loggerSpy = jest.spyOn(console, 'error');
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    // We have to reset the database to have no data just models
    let models = defineModels(sequelize);
    SellingPrice = models.SellingPrice;
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    loggerSpy.mockRestore();
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  //clear the logger spy before each test
  afterEach(async () => {
    loggerSpy.mockClear();
  });
  it('Should insert with no issues', async () => {
    const expectedMessage = {
      key: 0,
      value: 100,
      time: new Date('2024-01-01T01:00:00.000Z'),
    };
    const message = {
      key: Buffer.from(expectedMessage.key.toString()),
      value: Buffer.from(
        JSON.stringify({
          value: expectedMessage.value,
          date: expectedMessage.time.toISOString(),
        })
      ),
    } as KafkaMessage;

    await readSellingPriceMessages(SellingPrice, message);

    let tableEntries = await sequelize.query('SELECT * FROM selling_price;');

    expect(tableEntries[0].length).toBe(1);
    let entry: any = tableEntries[0][0];
    expect(entry).toMatchObject({
      amount: expectedMessage.value.toString(),
    });
    expect(entry.date.toISOString()).toBe(expectedMessage.time.toISOString());
  });

  it('should error but not fail from a duplicate date', async () => {
    const message = {
      key: Buffer.from('0'),
      value: Buffer.from(
        JSON.stringify({
          value: '1',
          date: '2024-01-03T01:00:00.000Z',
        })
      ),
    } as KafkaMessage;

    await readSellingPriceMessages(SellingPrice, message);
    await readSellingPriceMessages(SellingPrice, message);

    expect(loggerSpy).toHaveBeenCalledWith(duplicateErrorMsg);
  });
});

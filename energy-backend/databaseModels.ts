import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize('postgres://postgres:password@db:5432/retailerEnergy',
  {
    dialect: 'postgres',
    define: {
      timestamps: false,
    },
    protocol: 'postgres',
    dialectOptions: {}
  })

// Setup models to apply and represent the database schema. All properties are non-nullable,
// and the only nullable foreign keys exist in the entity_goal and report tables.
// Specific comments are added only to the first table, as all other follow the same format

// Create suburb related tables
// Properties defined from the schema document
const Suburb = sequelize.define("suburb", //set the name of the table
  {
    id: { // Name of the property
      primaryKey: true, // Mark this property as a primary key
      type: DataTypes.BIGINT, // The datatype
      allowNull: false // Stop it from being null
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    postcode: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    state: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    latitude: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL,
      allowNull: false
    }
  }, { freezeTableName: true }) //This stops sequelize from changing the table name from what we specified
const SuburbConsumption = sequelize.define("suburb_consumption",
  {
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    date: {
      primaryKey: true,
      type: DataTypes.DATE,
      allowNull: false
    },
    suburb_id: {
      primaryKey: true,
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, { freezeTableName: true })

// Link suburb to suburb consumption
// One to many relation
Suburb.hasMany(SuburbConsumption, {
  foreignKey: { name: "suburb_id", allowNull: false }
})
SuburbConsumption.belongsTo(Suburb, {
  foreignKey: { name: "suburb_id", allowNull: false }
})


// Create consumer related tables
// Properties defined from the schema document
const SellingPrice = sequelize.define("selling_price",
  {
    date: {
      primaryKey: true,
      type: DataTypes.DATE,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false
    }
  }, { freezeTableName: true })
const Consumer = sequelize.define("consumer",
  {
    id: {
      primaryKey: true,
      type: DataTypes.BIGINT,
      allowNull: false
    },
    street_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    high_priority: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    }
  }, { freezeTableName: true })
const ConsumerConsumption = sequelize.define("consumer_consumption",
  {
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      primaryKey: true
    },
    consumer_id: {
      primaryKey: true,
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, { freezeTableName: true })

// Link consumer to consumer consumption
// One to many relation
Consumer.hasMany(ConsumerConsumption, {
  foreignKey: { name: "consumer_id", allowNull: false }
})
ConsumerConsumption.belongsTo(Consumer, {
  foreignKey: { name: "consumer_id", allowNull: false }
})


// Link consumer to suburb
// Many to one relation
Suburb.hasMany(Consumer, {
  foreignKey: { name: "suburb_id", allowNull: false }
})
Consumer.belongsTo(Suburb, {
  foreignKey: { name: "suburb_id", allowNull: false }
})

// Create generator related tables
// Properties defined from the schema document
const SpotPrice = sequelize.define("spot_price",
  {
    date: {
      primaryKey: true,
      type: DataTypes.DATE,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false
    }
  }, { freezeTableName: true })
const GeneratorType = sequelize.define("generator_type",
  {
    id: {
      primaryKey: true,
      type: DataTypes.BIGINT,
      allowNull: false
    },
    category: {
      type: DataTypes.TEXT,
      unique: true,
      allowNull: false
    },
    renewable: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    }
  }, { freezeTableName: true })
const EnergyGenerator = sequelize.define("energy_generator",
  {
    id: {
      primaryKey: true,
      type: DataTypes.BIGINT,
      allowNull: false
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, { freezeTableName: true })
const EnergyGeneration = sequelize.define("energy_generation",
  {
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      primaryKey: true
    },
    energy_generator_id: {
      primaryKey: true,
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, { freezeTableName: true })

// Link GeneratorType to EnergyGenerator
// One to many relation
GeneratorType.hasMany(EnergyGenerator, { foreignKey: { name: "generator_type_id", allowNull: false } })
EnergyGenerator.belongsTo(GeneratorType, { foreignKey: { name: "generator_type_id", allowNull: false } })
// Link EnergyGenerator to EnergyGeneration
// One to many relation
EnergyGenerator.hasMany(EnergyGeneration, { foreignKey: { name: "energy_generator_id", allowNull: false } })
EnergyGeneration.belongsTo(EnergyGenerator, { foreignKey: { name: "energy_generator_id", allowNull: false } })
// Link suburb to energy generator
// One to many relation
Suburb.hasMany(EnergyGenerator, { foreignKey: { name: "suburb_id", allowNull: false } })
EnergyGenerator.belongsTo(Suburb, { foreignKey: { name: "suburb_id", allowNull: false } })

// Create goal and report related tables
// Properties defined from the schema document
const GoalType = sequelize.define("goal_type",
  {
    id: {
      primaryKey: true,
      type: DataTypes.BIGINT,
      allowNull: false
    },
    category: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, { freezeTableName: true })
const Goal = sequelize.define("goal",
  {
    id: {
      primaryKey: true,
      type: DataTypes.BIGINT,
      allowNull: false
    },
    target: {
      type: DataTypes.DECIMAL,
      allowNull: false
    }
  }, { freezeTableName: true })
const Reports = sequelize.define("report",
  {
    id: {
      primaryKey: true,
      type: DataTypes.BIGINT,
      allowNull: false
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, { freezeTableName: true })

const WarningType = sequelize.define("warning_type",
  {
    id: {
      primaryKey: true,
      type: DataTypes.BIGINT,
      allowNull: false
    },
    category: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    suggestion_description: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }
)
// Link goal type to entity goal
// One to many relation
GoalType.hasMany(Goal, { foreignKey: { name: "goal_id", allowNull: false } })
Goal.belongsTo(GoalType, { foreignKey: { name: "goal_id", allowNull: false } })
// Link consumer to entity goal
// One to many relation
Consumer.hasMany(Goal, { foreignKey: { name: "consumer_id", allowNull: true } })
Goal.belongsTo(Consumer, { foreignKey: { name: "consumer_id", allowNull: true } })
// Link suburb to report
// One to many relation
// Nulls are allowed
Suburb.hasMany(Reports, { foreignKey: { name: "suburb_id", allowNull: true } })
Reports.belongsTo(Suburb, { foreignKey: { name: "suburb_id", allowNull: true } })
// Link consumer to report
// One to many relation
// Nulls are allowed
Consumer.hasMany(Reports, { foreignKey: { name: "consumer_id", allowNull: true } })
Reports.belongsTo(Consumer, { foreignKey: { name: "consumer_id", allowNull: true } })

// Link goal and warning type
// One to One relation */
GoalType.hasOne(WarningType, { foreignKey: { name: "goal_type_id", allowNull: false } })
WarningType.belongsTo(GoalType, { foreignKey: { name: "goal_type_id", allowNull: false } })

/**
 * Create and insert a number of fake suburb entries
 * 
 * @param count How many dummy entries to produce
 * @returns A list of created suburb models
 */
async function makeDummySuburbs(count: number) {
  let suburbs: any[] = []
  for (let i = 0; i < count; i++) {
    suburbs.push(await Suburb.create({
      id: i,
      name: i.toString(),
      postcode: i * 1000,
      state: 'vic',
      latitude: 0.1 + i,
      longitude: 0.1 + i
    }))
  }
  return suburbs
}

/**
* Create and insert a number of fake consumer entries
* 
* @param count How many dummy entries to produce
* @returns A list of created consumer models
*/
async function makeDummyConsumers(count: number) {
  let consumers: any[] = []
  for (let i = 0; i < count; i++) {
    consumers.push(await Consumer.create({
      id: i,
      high_priority: false,
      street_address: "123, 123 street",
      suburb_id: 1
    }))
  }
  return consumers
}

/**
* Create and insert a number of fake generator entries
* 
* @param count How many dummy entries to produce
* @returns A list of created generator models
*/
async function makeDummyGenerators(count: number) {
  let generators: any[] = []
  await GeneratorType.create({ id: 1, category: "Gas", renewable: false })
  for (let i = 0; i < count; i++) {
    generators.push(await EnergyGenerator.create({
      id: i,
      name: "Loy Yang",
      suburb_id: 1,
      generator_type_id: 1
    }))
  }
  return generators
}

async function setupDatabase() {
  // Write the database schema to the database
  await sequelize.sync({ force: true })
    .then(() => {
      console.log("Database schema synced");
    })
    .catch((error) => {
      console.error("Unable to sync database schema: ", error);
    });
  // Convert relevant databases into timescale db hypertables
  await sequelize.query("SELECT create_hypertable('suburb_consumption', by_range('date'));");
  await sequelize.query("SELECT create_hypertable('consumer_consumption', by_range('date'));");
  await sequelize.query("SELECT create_hypertable('energy_generation', by_range('date'));");
  await sequelize.query("SELECT create_hypertable('selling_price', by_range('date'));");
  await sequelize.query("SELECT create_hypertable('spot_price', by_range('date'));");

}

/**
 * Inserts 10 dummy suburbs, consumers and generators each wth id's from 0-10
 * @param sequelize Connection to use to insert data
 */
async function makeDummyData(sequelize: Sequelize) {
  // Insert dummy data
  let dummysuburbs = await makeDummySuburbs(10)
  let dummyConsumers = await makeDummyConsumers(10)
  let dummyGenerators = await makeDummyGenerators(10)
}


export {
  sequelize,
  Suburb,
  SuburbConsumption,
  Consumer,
  ConsumerConsumption,
  GeneratorType,
  EnergyGenerator,
  EnergyGeneration,
  GoalType,
  Goal,
  Reports,
  WarningType,
  SellingPrice,
  SpotPrice,
  setupDatabase,
  makeDummyData
};
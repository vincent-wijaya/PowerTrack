import {
  Sequelize,
  DataTypes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';

export const defineModels = (sequelize: Sequelize) => {
  // Setup models to apply and represent the database schema. All properties are non-nullable,
  // and the only nullable foreign keys exist in the entity_goal and report tables.
  // Specific comments are added only to the first table, as all other follow the same format

  // Create suburb related tables
  // Properties defined from the schema document
  interface ISuburbModel
    extends Model<
      InferAttributes<ISuburbModel>,
      InferCreationAttributes<ISuburbModel>
    > {
    id: number;
    name: string;
    postcode: number;
    state: string;
    latitude: string; // Sequelize returns DataTypes.DECIMALs as strings. Bug: https://github.com/sequelize/sequelize/issues/8019
    longitude: string; // Sequelize returns DataTypes.DECIMALs as strings. Bug: https://github.com/sequelize/sequelize/issues/8019
  }
  const Suburb = sequelize.define<ISuburbModel>(
    'suburb', //set the name of the table
    {
      id: {
        // Name of the property
        primaryKey: true, // Mark this property as a primary key
        type: DataTypes.BIGINT, // The datatype
        allowNull: false, // Stop it from being null
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      postcode: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      state: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      latitude: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      longitude: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  ); //This stops sequelize from changing the table name from what we specified

  interface ISuburbConsumptionModel
    extends Model<
      InferAttributes<ISuburbConsumptionModel>,
      InferCreationAttributes<ISuburbConsumptionModel>
    > {
    amount: string;
    date: string;
    suburb_id: number;
  }
  const SuburbConsumption = sequelize.define<ISuburbConsumptionModel>(
    'suburb_consumption',
    {
      amount: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      date: {
        primaryKey: true,
        type: DataTypes.DATE,
        allowNull: false,
      },
      suburb_id: {
        primaryKey: true,
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );

  // Link suburb to suburb consumption
  // One to many relation
  Suburb.hasMany(SuburbConsumption, {
    foreignKey: { name: 'suburb_id', allowNull: false },
  });
  SuburbConsumption.belongsTo(Suburb, {
    foreignKey: { name: 'suburb_id', allowNull: false },
  });

  interface ISellingPriceModel
    extends Model<
      InferAttributes<ISellingPriceModel>,
      InferCreationAttributes<ISellingPriceModel>
    > {
    date: string;
    amount: string;
  }
  const SellingPrice = sequelize.define<ISellingPriceModel>(
    'selling_price',
    {
      date: {
        primaryKey: true,
        type: DataTypes.DATE,
        allowNull: false,
        unique: true,
      },
      amount: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );
  interface IConsumerModel
    extends Model<
      InferAttributes<IConsumerModel>,
      InferCreationAttributes<IConsumerModel>
    > {
    // Some fields are optional when calling UserModel.create() or UserModel.build()
    id: number;
    street_address: string;
    high_priority: boolean;
    latitude: string; // Sequelize returns DataTypes.DECIMALs as strings. Bug: https://github.com/sequelize/sequelize/issues/8019
    longitude: string; // Sequelize returns DataTypes.DECIMALs as strings. Bug: https://github.com/sequelize/sequelize/issues/8019
  }
  const Consumer = sequelize.define<IConsumerModel>(
    'consumer',
    {
      id: {
        primaryKey: true,
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      street_address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      high_priority: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      latitude: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      longitude: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );

  interface IConsumerConsumptionModel
    extends Model<
      InferAttributes<IConsumerConsumptionModel>,
      InferCreationAttributes<IConsumerConsumptionModel>
    > {
    amount: string;
    date: string;
    consumer_id: number;
  }
  const ConsumerConsumption = sequelize.define<IConsumerConsumptionModel>(
    'consumer_consumption',
    {
      amount: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATE,
        allowNull: false,
        primaryKey: true,
      },
      consumer_id: {
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );

  // Link consumer to consumer consumption
  // One to many relation
  Consumer.hasMany(ConsumerConsumption, {
    foreignKey: { name: 'consumer_id', allowNull: false },
  });
  ConsumerConsumption.belongsTo(Consumer, {
    foreignKey: { name: 'consumer_id', allowNull: false },
  });

  // Link consumer to suburb
  // Many to one relation
  Suburb.hasMany(Consumer, {
    foreignKey: { name: 'suburb_id', allowNull: false },
  });
  Consumer.belongsTo(Suburb, {
    foreignKey: { name: 'suburb_id', allowNull: false },
  });

  // Create generator related tables
  // Properties defined from the schema document
  interface ISpotPriceModel
    extends Model<
      InferAttributes<ISpotPriceModel>,
      InferCreationAttributes<ISpotPriceModel>
    > {
    date: string;
    amount: string;
  }
  const SpotPrice = sequelize.define<ISpotPriceModel>(
    'spot_price',
    {
      date: {
        primaryKey: true,
        type: DataTypes.DATE,
        allowNull: false,
        unique: true,
      },
      amount: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );
  interface IGeneratorTypeModel
    extends Model<
      InferAttributes<IGeneratorTypeModel>,
      InferCreationAttributes<IGeneratorTypeModel>
    > {
    id: number;
    category: string;
    renewable: boolean;
  }
  const GeneratorType = sequelize.define<IGeneratorTypeModel>(
    'generator_type',
    {
      id: {
        primaryKey: true,
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      category: {
        type: DataTypes.TEXT,
        unique: true,
        allowNull: false,
      },
      renewable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );
  interface IEnergyGeneratorModel
    extends Model<
      InferAttributes<IEnergyGeneratorModel>,
      InferCreationAttributes<IEnergyGeneratorModel>
    > {
    id: number;
    name: string;
  }
  const EnergyGenerator = sequelize.define<IEnergyGeneratorModel>(
    'energy_generator',
    {
      id: {
        primaryKey: true,
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );
  interface IEnergyGenerationModel
    extends Model<
      InferAttributes<IEnergyGenerationModel>,
      InferCreationAttributes<IEnergyGenerationModel>
    > {
    amount: string; // Sequelize returns DataTypes.DECIMALs as strings. Bug: https://github.com/sequelize/sequelize/issues/8019
    date: string;
    energy_generator_id: number;
  }
  const EnergyGeneration = sequelize.define<IEnergyGenerationModel>(
    'energy_generation',
    {
      amount: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATE,
        allowNull: false,
        primaryKey: true,
      },
      energy_generator_id: {
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );

  // Link GeneratorType to EnergyGenerator
  // One to many relation
  GeneratorType.hasMany(EnergyGenerator, {
    foreignKey: { name: 'generator_type_id', allowNull: false },
  });
  EnergyGenerator.belongsTo(GeneratorType, {
    foreignKey: { name: 'generator_type_id', allowNull: false },
  });
  // Link EnergyGenerator to EnergyGeneration
  // One to many relation
  EnergyGenerator.hasMany(EnergyGeneration, {
    foreignKey: { name: 'energy_generator_id', allowNull: false },
  });
  EnergyGeneration.belongsTo(EnergyGenerator, {
    foreignKey: { name: 'energy_generator_id', allowNull: false },
  });
  // Link suburb to energy generator
  // One to many relation
  Suburb.hasMany(EnergyGenerator, {
    foreignKey: { name: 'suburb_id', allowNull: false },
  });
  EnergyGenerator.belongsTo(Suburb, {
    foreignKey: { name: 'suburb_id', allowNull: false },
  });

  // Create goal and report related tables
  // Properties defined from the schema document
  interface IGoalTypeModel
    extends Model<
      InferAttributes<IGoalTypeModel>,
      InferCreationAttributes<IGoalTypeModel>
    > {
    id: number;
    category: string;
    description: string;
    target_type: 'retailer' | 'consumer';
  }
  const GoalType = sequelize.define<IGoalTypeModel>(
    'goal_type',
    {
      id: {
        primaryKey: true,
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      category: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      target_type: {
        type: DataTypes.ENUM('retailer', 'consumer'),
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );
  interface IGoalModel
    extends Model<
      InferAttributes<IGoalModel>,
      InferCreationAttributes<IGoalModel>
    > {
    id: number;
    target: string;
  }
  const Goal = sequelize.define<IGoalModel>(
    'goal',
    {
      id: {
        primaryKey: true,
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      target: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );
  interface IReportsModel
    extends Model<
      InferAttributes<IReportsModel>,
      InferCreationAttributes<IReportsModel>
    > {
    id: number;
    start_date: string;
    end_date: string;
  }
  const Reports = sequelize.define<IReportsModel>(
    'report',
    {
      id: {
        primaryKey: true,
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );

  interface IWarningTypeModel
    extends Model<
      InferAttributes<IWarningTypeModel>,
      InferCreationAttributes<IWarningTypeModel>
    > {
    id: number;
    category: string;
    description: string;
    trigger_greater_than: boolean;
    target: string;
  }
  const WarningType = sequelize.define<IWarningTypeModel>(
    'warning_type',
    {
      id: {
        primaryKey: true,
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      category: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      trigger_greater_than: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      target: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
    },
    { freezeTableName: true }
  );
  /* Link goal type to entity goal
   * One to many relation */
  GoalType.hasMany(Goal, { foreignKey: { name: 'goal_id', allowNull: false } });
  Goal.belongsTo(GoalType, {
    foreignKey: { name: 'goal_id', allowNull: false },
  });
  /* Link consumer to entity goal
   * One to many relation */
  Consumer.hasMany(Goal, {
    foreignKey: { name: 'consumer_id', allowNull: true },
  });
  Goal.belongsTo(Consumer, {
    foreignKey: { name: 'consumer_id', allowNull: true },
  });
  /* Link suburb to report
   * One to many relation
   * Nulls are allowed */
  Suburb.hasMany(Reports, {
    foreignKey: { name: 'suburb_id', allowNull: true },
  });
  Reports.belongsTo(Suburb, {
    foreignKey: { name: 'suburb_id', allowNull: true },
  });
  /* Link consumer to report
   * One to many relation
   * Nulls are allowed */
  Consumer.hasMany(Reports, {
    foreignKey: { name: 'consumer_id', allowNull: true },
  });
  Reports.belongsTo(Consumer, {
    foreignKey: { name: 'consumer_id', allowNull: true },
  });

  /* Link goal and warning type
   * Many to One relation */
  GoalType.hasMany(WarningType, {
    foreignKey: { name: 'goal_type_id', allowNull: false },
  });
  WarningType.belongsTo(GoalType, {
    foreignKey: { name: 'goal_type_id', allowNull: false },
  });

  return {
    sequelize,
    Suburb,
    SuburbConsumption,
    SellingPrice,
    Consumer,
    ConsumerConsumption,
    SpotPrice,
    GeneratorType,
    EnergyGenerator,
    EnergyGeneration,
    GoalType,
    Goal,
    Reports,
    WarningType,
  };
};

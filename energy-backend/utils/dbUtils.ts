import { col, fn, Op } from 'sequelize';

// Import the turf module for clustering
import { defineModels } from '../databaseModels';
import {
  kWhConversionMultiplier,
  getTemporalGranularity,
} from '../utils/utils';
import { differenceInHours } from 'date-fns';

type DbModelType = ReturnType<typeof defineModels>;

interface Price {
  date: string;
  amount: number;
}

/**
 * Retrieves consumer data.
 * @param models sequalize models
 * @param id id of consumer
 * @returns consumer data
 */
export async function getConsumer(models: DbModelType, id: number | string) {
  const { Consumer } = models;

  return await Consumer.findByPk(id);
}

export interface Energy {
  date: string;
  amount: number;
}

/**
 * Retrieves average energy generation data of a suburb (if provided) or nationwide from the database.
 *
 * @param models sequelize models
 * @param startDate start of date period
 * @param endDate end of date period
 * @param suburbId ID of suburb (optional)
 * @returns array of temporaly granulated energy generation data in time period
 */
export async function getEnergyGeneration(
  models: DbModelType,
  startDate: Date,
  endDate: Date,
  suburbId?: number | string
): Promise<Energy[]> {
  const { EnergyGeneration, EnergyGenerator } = models;

  // Define where clause for suburb (if provided)
  let suburbWhere: { suburb_id?: number } = {};
  if (suburbId) {
    suburbWhere.suburb_id = Number(suburbId);
  }

  // Define where clause for date range
  let dateGranularity = getTemporalGranularity(
    startDate.toISOString(),
    endDate.toISOString()
  );

  // Set up date range for query
  const dateWhere = {
    [Op.and]: {
      [Op.gt]: startDate,
      [Op.lte]: endDate,
    },
  };

  // Retrieve energy generation data based on the date granularity
  const result = await EnergyGeneration.findAll({
    attributes: [
      [fn('AVG', col('amount')), 'amount'], // Average the amount of energy generated
      [
        fn('date_trunc', dateGranularity.sequelize, col('date')),
        'truncatedDate',
      ], // Truncate the date based on the date granularity
    ],
    where: {
      date: dateWhere,
    },
    include: [
      {
        model: EnergyGenerator,
        attributes: [],
        where: suburbWhere,
      },
    ],
    group: ['truncatedDate'],
    order: [['truncatedDate', 'ASC']],
  });

  const multiplier = kWhConversionMultiplier(dateGranularity.name);

  const generation = result.map((item: any) => ({
    date: new Date(item.dataValues.truncatedDate).toISOString(),
    amount: Number(item.dataValues.amount) * multiplier, // Converts the energy consumed into kWh based on the temporal granularity
  }));

  return generation;
}

/**
 * Retrieves average energy consumption data of a suburb (optional) or suburb of a consumer (optional) or nationwide from the database.
 *
 * Cannot provide suburbId and consumerId together.
 *
 * @param models sequelize models
 * @param startDate start of date period
 * @param endDate end of date period
 * @param suburbId ID of suburb (optional)
 * @param consumerId ID of consumer (optional)
 * @returns array of temporaly granulated energy generation data in time period
 */
export async function getEnergyConsumption(
  models: DbModelType,
  startDate: Date,
  endDate: Date,
  suburbId?: number | string,
  consumerId?: number | string
): Promise<Energy[]> {
  const { ConsumerConsumption, SuburbConsumption } = models;

  // Define where clause for date range
  let dateGranularity = getTemporalGranularity(
    startDate.toISOString(),
    endDate.toISOString()
  );

  // Set up date range for query
  const dateWhere = {
    [Op.and]: {
      [Op.gt]: startDate,
      [Op.lte]: endDate,
    },
  };

  let result;

  if (suburbId) {
    result = await SuburbConsumption.findAll({
      attributes: [
        [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy generated
        [
          fn('date_trunc', dateGranularity.sequelize, col('date')),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate'],
      where: {
        suburb_id: suburbId,
        date: dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
    });
  } else if (consumerId) {
    result = await ConsumerConsumption.findAll({
      attributes: [
        [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy consumed
        [
          fn('date_trunc', dateGranularity.sequelize, col('date')),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate'],
      where: {
        consumer_id: consumerId,
        date: dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
    });
  } else {
    // Return nation-wide totals
    result = await SuburbConsumption.findAll({
      attributes: [
        [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy consumed
        [
          fn('date_trunc', dateGranularity.sequelize, col('date')),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate'],
      where: {
        date: dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
    });
  }

  const multiplier = kWhConversionMultiplier(dateGranularity.name);

  const consumption = result.map((item: any) => ({
    date: new Date(item.dataValues.truncatedDate).toISOString(),
    amount: Number(item.dataValues.amount) * multiplier, // Converts the energy consumed into kWh based on the temporal granularity
  }));

  return consumption;
}

/**
 * Retrieves green energy usage and goal statistics from the database.
 *
 * @param models sequelize models
 * @param startDate start of date period
 * @param endDate end of date period
 * @param suburbId ID of suburb
 * @returns percentage of energy generation is renewable, percentage progress towards green energy goal, and potential errors
 */
export async function getGreenEnergy(
  models: DbModelType,
  startDate?: Date,
  endDate?: Date,
  suburbId?: number | string
) {
  let dateWhere = {};
  if (startDate && endDate) {
    dateWhere = {
      [Op.and]: {
        [Op.gt]: startDate,
        [Op.lte]: endDate,
      },
    };
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateWhere = { [Op.gte]: yesterday };
  }

  // Define where clause for suburb (if provided)
  let suburbWhere: { suburb_id?: number } = {};
  if (suburbId) {
    suburbWhere.suburb_id = Number(suburbId);
  }

  // Fetch energy generation grouped by renewable (T/F) in the past 24 hours
  const energyGeneration = (await models.EnergyGeneration.findAll({
    attributes: [
      [fn('SUM', col('energy_generation.amount')), 'total_amount'],
      'energy_generator.generator_type.renewable',
    ],
    include: [
      {
        model: models.EnergyGenerator,
        attributes: [],
        where: {
          ...suburbWhere,
        },
        include: [
          {
            model: models.GeneratorType, // Joins generator type to get renewable information
            attributes: [],
          },
        ],
      },
    ],
    where: {
      date: dateWhere,
    },
    group: ['energy_generator.generator_type.renewable'], // Groups the result by renewable status
    raw: true,
  })) as unknown as { total_amount: string; renewable: boolean }[];

  const renewableGeneration = energyGeneration.find(
    (item) => item.renewable
  )?.total_amount;
  const nonrenewableGeneration = energyGeneration.find(
    (item) => !item.renewable
  )?.total_amount;

  // Check if there is no generation information
  const noData = !renewableGeneration && !nonrenewableGeneration;
  if (noData)
    return {
      data: {
        greenUsagePercent: null,
        greenGoalPercent: null,
      },
      error: {
        status: 400,
        message: 'No generation records in the last 24 hours were found.',
      },
    };

  // Calculate green energy generation percentage
  let greenUsagePercent;
  if (!renewableGeneration) {
    greenUsagePercent = 0;
  } else if (!nonrenewableGeneration) {
    greenUsagePercent = 1;
  } else {
    greenUsagePercent =
      parseFloat(renewableGeneration) /
      (parseFloat(nonrenewableGeneration) + parseFloat(renewableGeneration));
  }

  // Calculate percentage of green energy goal completed
  const greenTarget = (
    await models.WarningType.findOne({ where: { category: 'fossil_fuels' } })
  )?.target;
  if (!greenTarget) {
    return {
      data: {
        greenUsagePercent: null,
        greenGoalPercent: null,
      },
      error: {
        status: 400,
        message: 'No green target found.',
      },
    };
  }
  const greenGoalPercent = greenUsagePercent / parseFloat(greenTarget);

  return {
    data: {
      greenUsagePercent,
      greenGoalPercent,
    },
  };
}

export async function getEnergySourceBreakdown(
  models: DbModelType,
  startDate: Date,
  endDate: Date,
  suburbId?: number | string
) {
  const { EnergyGeneration, EnergyGenerator, GeneratorType } = models;

  // Set up date range for query
  const dateWhere = {
    [Op.and]: {
      [Op.gt]: startDate,
      [Op.lte]: endDate,
    },
  };

  // Define where clause for suburb (if provided)
  let suburbWhere: any = {};
  if (suburbId) {
    suburbWhere.suburb_id = suburbId;
  }

  const result = (await EnergyGeneration.findAll({
    attributes: [
      [col('energy_generator.id'), 'generator_id'],
      [col('energy_generator.generator_type.category'), 'category'],
      [col('energy_generator.generator_type.renewable'), 'renewable'],
      [fn('AVG', col('energy_generation.amount')), 'amount'],
    ],
    where: {
      date: dateWhere,
    },
    include: [
      {
        model: EnergyGenerator,
        attributes: [],
        where: {
          ...suburbWhere,
        },
        include: [
          {
            model: GeneratorType,
            attributes: [],
          },
        ],
      },
    ],
    group: [
      'energy_generator.id',
      'energy_generator.generator_type.category',
      'energy_generator.generator_type.renewable',
    ],
    order: [['category', 'ASC']],
    raw: true,
    nest: true,
  })) as unknown as {
    generator_id: number;
    category: string;
    amount: number;
    renewable: boolean;
  }[];

  interface AggregatedSource {
    category: string;
    renewable: boolean;
    amount: number;
  }

  interface SourcesMap {
    [category: string]: AggregatedSource;
  }

  // Aggregate all sources into their generatory types
  const processedSourcesMap = result.reduce<SourcesMap>((sources, source) => {
    if (!sources[source.category]) {
      sources[source.category] = {
        category: source.category,
        renewable: source.renewable,
        amount: 0,
      };
    }

    sources[source.category].amount += Number(source.amount);

    return sources;
  }, {});

  // Convert processedSources from a Map into an Array
  const processedSources = Object.keys(processedSourcesMap).map((category) => {
    return processedSourcesMap[category];
  });

  // Calculate total generation
  const totalAmount = processedSources.reduce(
    (total: number, source: { amount: number }) => {
      total += Number(source.amount);

      return total;
    },
    0
  );

  // Get the number of hours in the period to convert kW to kWh
  const hoursInPeriod = differenceInHours(endDate, startDate);

  return processedSources.map((source: { amount: number }) => ({
    ...source,
    percentage: Number(source.amount) / totalAmount, // Get the percentage share of this source
    amount: Number(source.amount) * hoursInPeriod, // Convert kW to kWh,
  }));
}

/**
 * Retrieve the average spot prices, selling prices, and profits (derived from selling price - spot price) during a given period of time.
 * Based on the time period, the data is aggregated by hour, day, or week. Profit is only calculated on dates that contain a selling price
 * or spot price. If a date is missing one of the price values, the previous value is used instead to calculate the profit of the particular
 * date.
 * @param models sequelize models
 * @param startDate start of date range
 * @param endDate end of date range
 * @returns arrays of selling price, spot price, and profit data
 */
export async function getProfitMargin(
  models: DbModelType,
  startDate: Date,
  endDate: Date
) {
  const { SellingPrice, SpotPrice } = models;

  // Set up date range for query
  const dateWhere = {
    [Op.and]: {
      [Op.gt]: startDate,
      [Op.lte]: endDate,
    },
  };

  // Determine the date granularity based on the date range
  let dateGranularity = getTemporalGranularity(
    startDate.toISOString(),
    endDate.toISOString()
  );

  interface Price {
    date: string;
    amount: number;
  }

  let sellingPricesData = (await SellingPrice.findAll({
    attributes: [
      [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy generated
      [
        fn('date_trunc', dateGranularity.sequelize, col('date')),
        'truncatedDate',
      ], // Truncate the date based on the date granularity
    ],
    group: ['truncatedDate'],
    where: {
      date: dateWhere,
    },
    order: [['truncatedDate', 'ASC']],
  })) as unknown as {
    date?: string;
    truncatedDate?: string;
    amount: number;
  }[];

  let spotPricesData = await SpotPrice.findAll({
    attributes: [
      [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy generated
      [
        fn('date_trunc', dateGranularity.sequelize, col('date')),
        'truncatedDate',
      ], // Truncate the date based on the date granularity
    ],
    group: ['truncatedDate'],
    where: {
      date: dateWhere,
    },
    order: [['truncatedDate', 'ASC']],
  });

  // Return empty arrays if no data is retrieved
  if (sellingPricesData.length === 0 && spotPricesData.length === 0) {
    return {
      spotPrices: [],
      sellingPrices: [],
      profits: [],
    };
  }

  // Get the last value before the query period if there are no selling/spot price data in this search
  if (sellingPricesData.length === 0) {
    const singleSellingPrice = await SellingPrice.findOne({
      where: {
        date: {
          [Op.lt]: startDate,
        },
      },
      order: [['id', 'DESC']],
    });

    if (singleSellingPrice) {
      sellingPricesData.push({
        date: singleSellingPrice.date,
        amount: Number(singleSellingPrice.amount),
      });
    }
  }

  // Get the last value before the query period if there are no selling/spot price data in this search
  if (spotPricesData.length === 0) {
    const singleSpotPrice = await SpotPrice.findOne({
      where: {
        date: {
          [Op.lt]: startDate,
        },
      },
      order: [['id', 'DESC']],
    });

    if (singleSpotPrice) {
      sellingPricesData.push({
        date: singleSpotPrice.date,
        amount: Number(singleSpotPrice.amount),
      });
    }
  }

  // Parse into expected output format
  const spotPrices: Price[] = spotPricesData.map((spotPrice: any) => ({
    date: spotPrice.dataValues.truncatedDate.toISOString(),
    amount: Number(spotPrice.amount),
  }));

  const sellingPrices: Price[] = sellingPricesData.map((sellingPrice: any) => ({
    date: sellingPrice.dataValues.truncatedDate.toISOString(),
    amount: Number(sellingPrice.amount),
  }));

  // Obtain unique dates of combined spot and selling prices by storing in a set
  let combinedDatesSet = new Set<String>();
  sellingPrices.forEach((sp) => {
    combinedDatesSet.add(sp.date);
  });
  spotPrices.forEach((sp) => {
    combinedDatesSet.add(sp.date);
  });

  const combinedDatesArray = Array.from(combinedDatesSet).sort((a, b) => {
    const dateA = new Date(a as string);
    const dateB = new Date(b as string);
    return dateA.getTime() - dateB.getTime();
  });
  /* Calculate Profit */
  // Convert selling prices into a map so that its key can be used for easier access
  const sellingPricesMap: Map<string, Price> = sellingPrices.reduce(
    (map: Map<string, Price>, sellingPrice: Price) => {
      const date = sellingPrice.date;
      map.set(date, {
        date,
        amount: Number(sellingPrice.amount),
      });

      return map;
    },
    new Map<string, Price>()
  );

  // Convert spot prices into a map so that its key can be used for easier access
  const spotPricesMap: Map<string, Price> = spotPrices.reduce(
    (map: Map<string, Price>, spotPrice: Price) => {
      const date = spotPrice.date;
      map.set(date, {
        date,
        amount: Number(spotPrice.amount),
      });

      return map;
    },
    new Map<string, Price>()
  );

  let profits: Price[] = [];
  let lastSellingPrice: number = Number(sellingPricesData[0]?.amount); // Store last available selling price for following calculations where selling price is missing but spot price exists for a particular date
  let lastSpotPrice: number = Number(spotPricesData[0]?.amount); // Opposite of above

  // Iterate through the granular dates in the period and get the profit by getting the difference between the selling price and spot price
  for (const date of combinedDatesArray) {
    const sellingPriceEntry = sellingPricesMap.get(date as string);
    const spotPriceEntry = spotPricesMap.get(date as string);

    // If spot price or selling price is missing, take the last available value
    const sellingPrice: number = sellingPriceEntry?.amount ?? lastSellingPrice;
    const spotPrice: number = spotPriceEntry?.amount ?? lastSpotPrice;

    profits.push({
      date: date as string,
      amount: Number(sellingPrice) - Number(spotPrice),
    });

    // Store current prices as last selling/spot prices to be used on subsequent calculations for missing values
    lastSellingPrice = sellingPrice;
    lastSpotPrice = spotPrice;
  }

  return {
    sellingPrices,
    spotPrices,
    profits,
  };
}

/**
 * Calculates the amount the user spent on energy consumption hourly, daily, or weekly in a date range.
 * Energy consumed and energy buying price are aggregated by the temporal granularity and values from the corresponding dates are multiplied together.
 * In cases where energy consumption or energy price are unavailable for the certain truncated date, the previous value will be used instead in the multiplication.
 * In the case where no data exists for both models, and when either one does not have any values historically, an empty array is returned
 * @param models sequelize models
 * @param startDate start of date range
 * @param endDate end of date range
 * @param consumerId ID of consumer (optional)
 * @returns array of amounts the consumer spent on energy consumption
 */
export const getSpending = async (
  models: DbModelType,
  startDate: Date,
  endDate: Date,
  consumerId?: number
) => {
  const { ConsumerConsumption, SellingPrice } = models;

  console.log(consumerId);

  // Set up date range for query
  const dateWhere = {
    [Op.and]: {
      [Op.gt]: startDate,
      [Op.lte]: endDate,
    },
  };

  // Determine the date granularity based on the date range
  let dateGranularity = getTemporalGranularity(
    startDate.toISOString(),
    endDate.toISOString()
  );

  let consumptions = await getEnergyConsumption(
    models,
    startDate,
    endDate,
    undefined,
    consumerId
  );

  const sellingPricesData = (await SellingPrice.findAll({
    attributes: [
      [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy generated
      [
        fn('date_trunc', dateGranularity.sequelize, col('date')),
        'truncatedDate',
      ], // Truncate the date based on the date granularity
    ],
    group: ['truncatedDate'],
    where: {
      date: dateWhere,
    },
    order: [['truncatedDate', 'ASC']],
  })) as unknown as {
    date?: string;
    truncatedDate?: string;
    amount: number;
  }[];

  // Return empty arrays if no data is retrieved
  if (consumptions.length === 0 && sellingPricesData.length === 0) {
    return [];
  }

  // Get the last value before the query period if there are no consumption data in this search
  if (consumptions.length === 0) {
    const singleConsumption = await ConsumerConsumption.findOne({
      where: {
        date: {
          [Op.lt]: startDate,
        },
        consumer_id: consumerId,
      },
      order: [['consumer_id', 'DESC']],
    });

    if (singleConsumption) {
      consumptions.push({
        date: singleConsumption.date,
        amount: Number(singleConsumption.amount),
      });
    }
  }

  // Get the last value before the query period if there are no selling data in this search
  if (sellingPricesData.length === 0) {
    const singleSellingPrice = await SellingPrice.findOne({
      where: {
        date: {
          [Op.lt]: startDate,
        },
      },
      order: [['id', 'DESC']],
    });

    if (singleSellingPrice) {
      sellingPricesData.push({
        date: singleSellingPrice.date,
        amount: Number(singleSellingPrice.amount),
      });
    }
  }

  // Return empty arrays if either values are still empty
  if (consumptions.length === 0 || sellingPricesData.length === 0) {
    return [];
  }

  const sellingPrices: Price[] = sellingPricesData.map((sellingPrice: any) => ({
    date: sellingPrice.dataValues.truncatedDate.toISOString(),
    amount: Number(sellingPrice.amount),
  }));

  // Obtain unique dates of combined consumption and selling prices by storing in a set
  let combinedDatesSet = new Set<String>();
  consumptions.forEach((sp) => {
    combinedDatesSet.add(sp.date);
  });
  sellingPrices.forEach((sp) => {
    combinedDatesSet.add(sp.date);
  });

  const combinedDatesArray = Array.from(combinedDatesSet).sort((a, b) => {
    const dateA = new Date(a as string);
    const dateB = new Date(b as string);
    return dateA.getTime() - dateB.getTime();
  });
  /* Calculate Spending */
  // Convert consumptions into a map so that its key can be used for easier access
  const consumptionsMap: Map<string, Energy> = consumptions.reduce(
    (map: Map<string, Energy>, consumption: Energy) => {
      const date = consumption.date;
      map.set(date, {
        date,
        amount: Number(consumption.amount),
      });

      return map;
    },
    new Map<string, Price>()
  );

  // Convert selling prices into a map so that its key can be used for easier access
  const sellingPricesMap: Map<string, Price> = sellingPrices.reduce(
    (map: Map<string, Price>, sellingPrice: Price) => {
      const date = sellingPrice.date;
      map.set(date, {
        date,
        amount: Number(sellingPrice.amount),
      });

      return map;
    },
    new Map<string, Price>()
  );

  let spending: Price[] = [];
  let lastSellingPrice: number = Number(sellingPricesData[0]?.amount); // Store last available selling price for following calculations where selling price is missing but spot price exists for a particular date
  let lastConsumptionAmount: number = Number(consumptions[0]?.amount); // Store last available consumption for following calculations where consumption data is missing
  // Iterate through the granular dates in the period and get the profit by getting the difference between the selling price and spot price
  for (const date of combinedDatesArray) {
    const consumptionEntry = consumptionsMap.get(date as string);
    const sellingPriceEntry = sellingPricesMap.get(date as string);

    // If spot price or selling price is missing, take the last available value
    const consumption: number =
      consumptionEntry?.amount ?? lastConsumptionAmount;
    const sellingPrice: number = sellingPriceEntry?.amount ?? lastSellingPrice;

    spending.push({
      date: date as string,
      amount: Number(consumption) * Number(sellingPrice),
    });

    // Store current prices as last selling/spot prices to be used on subsequent calculations for missing values
    lastConsumptionAmount = consumption;
    lastSellingPrice = sellingPrice;
  }

  return spending;
};

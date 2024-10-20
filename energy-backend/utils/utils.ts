import {
  differenceInMonths,
  isBefore,
  isValid,
  differenceInWeeks,
  parseISO,
} from 'date-fns';

/**
 * Determines the temporal granularity based on the period between start and end dates.
 * As written on the API specification document:
 * - weekly: greater than or equal to 1 month
 * - daily: between 1 week and 1 month
 * - hourly: less than 1 week
 *
 * @param startDate start date of period
 * @param endDate end date of period
 * @returns the name of the temporal granularity as in the API specification document, and the adverb
 *  version of the word that is used for the sequelize date-truncating function 'date_trunc'.
 */
export function getTemporalGranularity(
  startDate: string,
  endDate: string
): { name: string; sequelize: string } {
  if (differenceInMonths(endDate, startDate) >= 1) {
    return {
      name: 'weekly',
      sequelize: 'week',
    };
  } else if (differenceInWeeks(endDate, startDate) >= 1) {
    return {
      name: 'daily',
      sequelize: 'day',
    };
  } else {
    return {
      name: 'hourly',
      sequelize: 'hour',
    };
  }
}

/**
 * Provides the multiplier to convert the energy amount from kW to kWh.
 *
 * Multiplies the energy amount (kW) with the number of hours in the period based on the temporal granularity (h)
 * to obtain the amount in kWh.
 *
 * Multipliers:
 * - weekly: 7 * 24 = 168 hours
 * - daily: 24 hours
 * - hourly: 1 hour
 *
 * @param granularity the temporal granularity of the period
 * @returns a multiplier of the number of hours in the period
 */
export function kWhConversionMultiplier(granularity: string): number {
  const WEEK_HOURS = 7 * 24;
  const DAY_HOURS = 24;
  const HOUR_HOURS = 1;

  switch (granularity) {
    case 'weekly':
      return WEEK_HOURS;
    case 'daily':
      return DAY_HOURS;
    case 'hourly':
      return HOUR_HOURS;
    default:
      console.error('Temporal granularity type invalid.');
      return 0;
  }
}

export function isValidId(id: number | string) {
  return Number.isInteger(Number(id));
}

export function validateDateInputs(startDate: String, endDate?: String) {
  // If no date range is provided, return error 400
  if (!startDate || startDate === 'undefined') {
    return {
      error: {
        status: 400,
        message: 'Start date must be provided.',
      },
    };
  }

  // Validate format of start_date
  if (!isValid(parseISO(String(startDate)))) {
    return {
      error: {
        status: 400,
        message:
          'Invalid start date format. Provide dates in ISO string format.',
      },
    };
  }
  const parsedStartDate = new Date(String(startDate));

  let parsedEndDate;
  if (endDate && endDate !== 'undefined') {
    // Validate format of end_date
    if (!isValid(parseISO(String(endDate)))) {
      return {
        error: {
          status: 400,
          message:
            'Invalid end date format. Provide dates in ISO string format.',
        },
      };
    }
    parsedEndDate = new Date(String(endDate));
  } else {
    // Set end_date to now if not provided
    parsedEndDate = new Date();
  }

  // Validate that end_date is after start_date
  if (isBefore(parsedEndDate, parsedStartDate)) {
    return {
      error: {
        status: 400,
        message: 'Start date must be before end date.',
      },
    };
  }

  if (isBefore(new Date(), parsedEndDate)) {
    return {
      error: {
        status: 400,
        message: 'End date must not be in the future.',
      },
    };
  }

  return {
    data: {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    },
  };
}

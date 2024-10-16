'use client';
import React, { useState } from 'react';
import Dropdown, { DropdownOption } from './dropDownFilter'; // Adjust the path based on your folder structure
import LineChart from './lineChart';
import {
  EnergyConsumptionAmount,
} from '@/api/getEnergyConsumption';

import { generateDateRange } from '@/utils';

interface ConsumerSpendChartProps {
  chartTitle: string;
  consumptionData: EnergyConsumptionAmount[];
  showTimeRangeDropdown?: boolean;
  onTimeRangeChange?: (value: DropdownOption) => void;
  granularity: string;
  className?: string;
  buyingPrice: number;
}

function ConsumerSpendChart(props: ConsumerSpendChartProps) {
  const [consumerSpendChartDateRange, setConsumerSpendChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year'));

  let datasets = [
    {
      label: 'Spending',
      data: props.consumptionData?.map(
        (c: EnergyConsumptionAmount) => {
          return {
            x: c.date,
            y: (Number(c.amount) * props.buyingPrice).toFixed(2),
          };
        }
      ) ?? [],
      borderColor: 'red',
      backgroundColor: 'white',
    },
  ];

  return (
    <div>
      <div className="flex flex-grow justify-center items-center ">
        <div className="w-full bg-itembg border border-stroke rounded-lg p-4">
          {props.showTimeRangeDropdown && props.onTimeRangeChange ? (
            <Dropdown
              onChange={props.onTimeRangeChange}
              chartTitle={props.chartTitle}
            />
          ) : null}
          <LineChart
            chartTitle="Spending"
            datasets={datasets}
            xAxisTitle="Date"
            yAxisTitle="Amount (AUD $)"
            xAxisUnit={consumerSpendChartDateRange.granularity}
          />
        </div>
      </div>
      <div className="mt-4 mx-auto w-1/2"></div>
    </div>
  );
}

export default ConsumerSpendChart;

'use client';
import React, { useState } from 'react';
import Dropdown, { DropdownOption } from './dropDownFilter'; // Adjust the path based on your folder structure
import LineChart from './lineChart';
import {
  EnergyConsumptionAmount,
  EnergyConsumptionData,
} from '@/api/getEnergyConsumption';
import { generateDateRange } from '@/utils';

interface EnergyChartProps {
  chartTitle: string;
  energyConsumptionData: EnergyConsumptionData;
  energyGenerationData?: EnergyConsumptionData;
  showTimeRangeDropdown?: boolean;
  onTimeRangeChange?: (value: DropdownOption) => void;
  granularity: string;
  className?: string;
}

function EnergyChart(props: EnergyChartProps) {
  const [energyChartDateRange, setEnergyChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year'));

  let datasets = [
    {
      label: 'Energy Consumption',
      data: props.energyConsumptionData?.energy.map(
        (c: EnergyConsumptionAmount) => {
          return {
            x: c.date,
            y: c.amount.toFixed(2),
          };
        }
      ),
      borderColor: 'red',
      backgroundColor: 'white',
    },
  ];

  if (props.energyGenerationData) {
    datasets.push({
      label: 'Energy Generation',
      data: props.energyGenerationData?.energy.map(
        (c: EnergyConsumptionAmount) => {
          return {
            x: c.date,
            y: c.amount.toFixed(2),
          };
        }
      ),
      borderColor: 'blue',
      backgroundColor: 'white',
    });
  }

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
            chartTitle=""
            datasets={datasets}
            xAxisTitle="Date"
            yAxisTitle="Amount (KWH)"
            xAxisUnit={energyChartDateRange.granularity}
          />
        </div>
      </div>
      <div className="mt-4 mx-auto w-1/2"></div>
    </div>
  );
}

export default EnergyChart;

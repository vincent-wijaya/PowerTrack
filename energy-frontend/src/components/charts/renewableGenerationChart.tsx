'use client';
import React from 'react';
import Dropdown, { DropdownOption } from './dropDownFilter'; // Adjust the path based on your folder structure
import LineChart from './lineChart';
import { RenewableEnergyGenerationAmount } from '@/api/getRenewableEnergyGeneration';

interface EnergyChartProps {
  chartTitle: string;
  energyGenerationData?: RenewableEnergyGenerationAmount[];
  showTimeRangeDropdown?: boolean;
  onTimeRangeChange?: (value: string) => void;
  granularity: string;
  className?: string;
}

function RenewableEnergyChart(props: EnergyChartProps) {
  let datasets = [
    {
      label: 'Energy Generation kWh',
      data:
        props.energyGenerationData?.map(
          (c: RenewableEnergyGenerationAmount) => {
            return {
              x: c.date,
              y: c.amount.toFixed(2),
            };
          }
        ) ?? [],
      borderColor: 'green',
      backgroundColor: 'white',
    },
  ];

  return (
    <div>
      <div className="flex flex-grow justify-center items-center ">
        <div className="w-full bg-itembg border border-stroke rounded-lg p-4">
          <LineChart
            chartTitle={props.chartTitle}
            datasets={datasets}
            xAxisTitle="Date"
            yAxisTitle="Amount (kWh)"
            xAxisUnit={props.granularity}
            showDateRangeDropdown={true}
            onDateRangeChange={props.onTimeRangeChange}
          />
        </div>
      </div>
      <div className="mt-4 mx-auto w-1/2"></div>
    </div>
  );
}

export default RenewableEnergyChart;

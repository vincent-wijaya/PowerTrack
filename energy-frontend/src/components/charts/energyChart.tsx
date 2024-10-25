'use client';
import React from 'react';
import LineChart from './lineChart';
import { EnergyConsumptionAmount } from '@/api/getEnergyConsumption';
import { EnergyGenerationAmount } from '@/api/getEnergyGeneration';

interface EnergyChartProps {
  chartTitle: string;
  energyConsumptionData: EnergyConsumptionAmount[];
  energyGenerationData?: EnergyGenerationAmount[];
  showTimeRangeDropdown?: boolean;
  onTimeRangeChange?: (value: string) => void;
  granularity: string;
  className?: string;
}

function EnergyChart(props: EnergyChartProps) {
  const datasets = [
    {
      label: 'Energy Consumption kWh',
      data:
        props.energyConsumptionData?.map((c: EnergyConsumptionAmount) => {
          return {
            x: c.date,
            y: c.amount.toFixed(2),
          };
        }) ?? [],
      borderColor: 'red',
      backgroundColor: 'white',
    },
    {
      label: 'Energy Generation kWh',
      data:
        props.energyGenerationData?.map((c: EnergyGenerationAmount) => {
          return {
            x: c.date,
            y: c.amount.toFixed(2),
          };
        }) ?? [],
      borderColor: 'blue',
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

export default EnergyChart;

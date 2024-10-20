'use client';
import React from 'react';
import LineChart from './lineChart';
import { Price } from '@/api/getProfitMargin';

interface ConsumerSpendChartProps {
  chartTitle: string;
  spendingData: Price[];
  showTimeRangeDropdown?: boolean;
  onTimeRangeChange?: (value: string) => void;
  granularity: string;
  className?: string;
}

function ConsumerSpendChart(props: ConsumerSpendChartProps) {
  let datasets = [
    {
      label: 'Spending $',
      data:
        props.spendingData?.map((c: Price) => {
          return {
            x: c.date,
            y: c.amount.toFixed(2),
          };
        }) ?? [],
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
            yAxisTitle="Amount (AUD $)"
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

export default ConsumerSpendChart;

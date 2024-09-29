'use client';
import React from 'react';
import Dropdown, { DropdownOption } from './dropDownFilter'; // Adjust the path based on your folder structure
import LineChart from './lineChart';
import { ProfitMarginData } from '@/api/getProfitMargin';

interface ProfitChartProps {
  chartTitle: string;
  profitMarginData?: ProfitMarginData;
  showTimeRangeDropdown?: boolean;
  onTimeRangeChange?: (value: DropdownOption) => void;
  granularity: string;
  className?: string;
}

function ProfitChart(props: ProfitChartProps) {
  return (
    <div
      className={`w-full bg-itembg border border-stroke rounded-lg p-4 ${props.className ? props.className : ''}`}
    >
      <div className="justify-center items-center">
        <div className="drop-shadow-md border-chartBorder ">
          {props.showTimeRangeDropdown && props.onTimeRangeChange ? (
            <Dropdown
              onChange={props.onTimeRangeChange}
              chartTitle={props.chartTitle}
            />
          ) : null}
          <LineChart
            chartTitle=""
            // xAxisLabels={spotPriceData.map((_, index) => `Day ${index + 1}`)}
            datasets={[
              {
                label: 'Profit $',
                data:
                  props.profitMarginData?.values.profits?.map((p) => {
                    return {
                      x: p.date,
                      y: p.amount.toFixed(2),
                    };
                  }) ?? [],
                borderColor: 'purple',
                backgroundColor: 'white',
              },
              {
                label: 'Spot Price $',
                data:
                  props.profitMarginData?.values.spot_prices?.map((sp) => {
                    return {
                      x: sp.date,
                      y: sp.amount.toFixed(2),
                    };
                  }) ?? [],
                borderColor: 'red',
                backgroundColor: 'white',
              },
              {
                label: 'Selling Price $',
                data:
                  props.profitMarginData?.values.selling_prices?.map((sp) => {
                    return {
                      x: sp.date,
                      y: sp.amount.toFixed(2),
                    };
                  }) ?? [],
                borderColor: 'blue',
                backgroundColor: 'white',
              },
            ]}
            xAxisTitle="Date"
            yAxisTitle="Value (AUD)"
            xAxisUnit={props.granularity}
          />
        </div>
      </div>
    </div>
  );
}

export default ProfitChart;

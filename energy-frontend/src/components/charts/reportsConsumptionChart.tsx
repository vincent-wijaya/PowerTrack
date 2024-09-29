'use client';
import LineChart from './lineChart';
import React, { useEffect, useState } from 'react';

function ReportsConsumptionChart(props: {
  dataArray: any[];
  xAxisData: string[];
  chartTitle: string;
}) {
  return (
    <div>
      <div className="flex flex-grow justify-center items-center ">
        <div className="w-full bg-itembg border border-stroke rounded-lg p-4">
          <LineChart
            chartTitle={props.chartTitle}
            xAxisLabels={props.xAxisData}
            datasets={props.dataArray}
            xAxisTitle="Date"
            yAxisTitle="Amount (KWH)"
          />
        </div>
      </div>
      <div className="mt-4 mx-auto w-1/2"></div>
    </div>
  );
}

export default ReportsConsumptionChart;

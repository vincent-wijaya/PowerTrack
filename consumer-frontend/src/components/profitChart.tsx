'use client';
import React, { useEffect, useState } from 'react';
import Dropdown from './dropDownFilter'; // Adjust the path based on your folder structure
import LineChart from './lineChart';

function ProfitChart(props: { className?: string }) {
  const [profitData, setProfitData] = useState<number[]>([]);
  const [spotPriceData, setSpotPriceData] = useState<number[]>([]);
  const [sellingPriceData, setSellingPriceData] = useState<number[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<string>('last_year');

  const generateData = () => {
    const newData = Math.floor(Math.random() * (200 - 50 + 1)) + 50;
    return newData;
  };

  const fetchData = async () => {
    // Logic to fetch data based on selectedTimeRange
    // Adjust the fetching logic based on the selected time range
  };

  useEffect(() => {
    const interval1 = setInterval(() => {
      setProfitData((prevData) => [...prevData, generateData()]);
    }, 50000);
    return () => clearInterval(interval1);
  }, []);

  useEffect(() => {
    const interval2 = setInterval(() => {
      setSpotPriceData((prevData) => [...prevData, generateData()]);
    }, 50000);
    return () => clearInterval(interval2);
  }, []);

  useEffect(() => {
    const interval3 = setInterval(() => {
      setSellingPriceData((prevData) => [...prevData, generateData()]);
    }, 50000);
    return () => clearInterval(interval3);
  }, []);

  useEffect(() => {
    // Fetch data when selectedTimeRange changes
    fetchData();
  }, [selectedTimeRange]);

  const handleTimeRangeChange = (value: string) => {
    setSelectedTimeRange(value);
  };

  return (
    <div
      className={`bg-itembg border border-stroke rounded-lg p-4 ${props.className ? props.className : ''}`}
    >
      <div className="justify-center items-center">
        <div className="drop-shadow-md border-chartBorder ">
          <Dropdown
            onChange={handleTimeRangeChange}
            chartTitle={'Profit Analysis'}
          />
          <LineChart
            chartTitle=""
            xAxisLabels={profitData.map((_, index) => `Day ${index + 1}`)}
            datasets={[
              {
                label: 'Profit',
                data: profitData,
                borderColor: 'purple',
                backgroundColor: 'white',
              },
              {
                label: 'Spot Price',
                data: spotPriceData,
                borderColor: 'red',
                backgroundColor: 'white',
              },
              {
                label: 'Selling Price',
                data: sellingPriceData,
                borderColor: 'blue',
                backgroundColor: 'white',
              },
            ]}
            xAxisTitle="Day"
            yAxisTitle="Value (AUD)"
          />
        </div>
      </div>
    </div>
  );
}

export default ProfitChart;

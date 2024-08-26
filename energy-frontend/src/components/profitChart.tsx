'use client';
import React, { useEffect, useState } from 'react';
import Dropdown from './dropDownFilter'; // Adjust the path based on your folder structure
import LineChart from './lineChart';
import useSWR from 'swr';
import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';

function ProfitChart(props: { className?: string }) {
  const [profitData, setProfitData] = useState<number[]>([]);
  const [spotPriceData, setSpotPriceData] = useState<number[]>([]);
  const [sellingPriceData, setSellingPriceData] = useState<number[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<string>('last_year');

  const generateDateRange = (timeRange: string) => {
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case 'last_year':
        startDate = new Date(
          now.getFullYear() - 1,
          now.getMonth(),
          now.getDate()
        );
        break;
      case 'last_six_months':
        startDate = new Date(
          now.getFullYear(),
          now.getMonth() - 6,
          now.getDate()
        );
        break;
      case 'last_month':
        startDate = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          now.getDate()
        );
        break;
      case 'last_week':
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 7
        );
        break;
      case 'last_24_hours':
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1
        );
        break;
      default:
        startDate = new Date(
          now.getFullYear() - 1,
          now.getMonth(),
          now.getDate()
        );
    }
    return {
      start: startDate.toISOString(),
      end: now.toISOString(),
    };
  };

  const generateData = () => {
    const newData = Math.floor(Math.random() * (200 - 50 + 1)) + 50;
    return newData;
  };

  const fetchData = () => {
    const dateRange = generateDateRange(selectedTimeRange);
    let start_date = dateRange.start;
    let params = {
      start_date: start_date,
    };
    const url = `${process.env.NEXT_PUBLIC_API_URL}/retailer/profitMargin&start_date=${params.start_date}`;
    return url;
  };
  const { data, error } = useSWR(() => fetchData(), fetcher, {
    refreshInterval: POLLING_RATE,
  });

  useEffect(() => {
    if (data) {
      setProfitData(data);
    }
  }, [data]);

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

'use client';
import React, { useEffect, useState } from 'react';
import Dropdown from './dropDownFilter'; // Adjust the path based on your folder structure
import LineChart from './lineChart';
import { fetcher } from '@/utils';
import useSWR from 'swr';

function EnergyChart(props: { chartTitle: string; context_id: string }) {
  const [consumptionData, setConsumptionData] = useState<number[]>([]);
  const [generationData, setGenerationData] = useState<number[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<string>('last_year');
  const [dateArray, setDateArray] = useState<string[]>([]);

  const generateData = () => {
    const newData = Math.floor(Math.random() * (200 - 50 + 1)) + 50;
    return newData;
  };

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

  const getDataUrl = (endpoint: string) => {
    const dateRange = generateDateRange(selectedTimeRange);
    const { start, end } = dateRange;
    const params = new URLSearchParams({
      start_date: start,
      ...(props.context_id !== 'Nation' && { suburb_id: props.context_id }),
    });

    return `${process.env.NEXT_PUBLIC_API_URL}/retailer/${endpoint}?${params.toString()}`;
  };

  // Fetching consumption data
  const { data: apiConsumptionData, error: consumptionError } = useSWR(
    getDataUrl('consumption'),
    fetcher,
    {
      refreshInterval: 600000, // Refresh data every minute
    }
  );
  // Fetching generation data
  const { data: apiGenerationData, error: generationError } = useSWR(
    getDataUrl('generation'),
    fetcher,
    {
      refreshInterval: 600000, // Refresh data every minute
    }
  );

  // useEffect(() => {
  //   // Set up the interval for generating generation data
  //   const generationInterval = setInterval(() => {
  //     setGenerationData((prevData) => [...prevData, generateData()]);
  //   }, 50000);

  //   // Set up the interval for generating consumption data
  //   const consumptionInterval = setInterval(() => {
  //     setConsumptionData((prevData) => [...prevData, generateData()]);
  //   }, 50000);

  //   // Clean up the intervals on component unmount
  //   return () => {
  //     clearInterval(generationInterval);
  //     clearInterval(consumptionInterval);
  //   };
  // }, []);

  //uncomment for actual data

  useEffect(() => {
    if (apiConsumptionData) {
      const consumptionVal = apiConsumptionData.energy.map(
        (item: any) => item.amount
      );

      setConsumptionData(consumptionVal);
    }
  }, [apiConsumptionData]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.getMonth();
    const year = date.getFullYear();

    // Array of month names
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    if (selectedTimeRange === 'last_24_hours') {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'pm' : 'am';
      const hour12 = hours % 12 || 12; // Convert to 12-hour format
      const minuteStr = String(minutes).padStart(2, '0');
      return `${day}/${month + 1} ${hour12}:${minuteStr} ${ampm}`;
    } else if (
      selectedTimeRange === 'last_year' ||
      selectedTimeRange === 'last_six_months'
    ) {
      // Format date as "Mon Year" for last year and last six months
      return `${monthNames[month]} ${year}`;
    } else {
      // Default format for other time ranges
      const shortYear = String(year).slice(-2); // Get last two digits of the year
      return `${day}/${month + 1}/${shortYear}`;
    }
  };

  useEffect(() => {
    if (apiGenerationData) {
      const generationVal = apiGenerationData.energy.map(
        (item: any) => item.amount
      );
      const tempDateArray = apiGenerationData.energy.map(
        (item: any) => formatDate(item.date) // Convert date to dd/mm/yy format
      );
      setGenerationData(generationVal);
      setDateArray(tempDateArray);
    }
  }, [apiGenerationData]);

  const handleTimeRangeChange = (value: string) => {
    setSelectedTimeRange(value);
  };

  const datasets = [
    {
      label: 'Energy Consumption',
      data: consumptionData,
      borderColor: 'red',
      backgroundColor: 'white',
    },
    {
      label: 'Energy Generation',
      data: generationData,
      borderColor: 'blue',
      backgroundColor: 'white',
    },
  ];

  return (
    <div>
      <div className="flex flex-grow justify-center items-center ">
        <div className="w-full bg-itembg border border-stroke rounded-lg p-4">
          <Dropdown
            onChange={handleTimeRangeChange}
            chartTitle={props.chartTitle}
          />
          <LineChart
            chartTitle=""
            xAxisLabels={dateArray}
            datasets={datasets}
            xAxisTitle="Date"
            yAxisTitle="Amount (KWH)"
          />
        </div>
      </div>
      <div className="mt-4 mx-auto w-1/2"></div>
    </div>
  );
}

export default EnergyChart;

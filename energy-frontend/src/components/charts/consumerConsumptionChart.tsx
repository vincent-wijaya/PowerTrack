'use client';
import React, { useEffect, useState } from 'react';
import Dropdown from './dropDownFilter'; // Adjust the path based on your folder structure
import LineChart from './lineChart';
import { fetcher } from '@/utils';
import useSWR from 'swr';
import { POLLING_RATE } from '@/config';

function ConsumerEnergyChart(props: { chartName: string; context_id: string }) {
  const [consumptionData, setConsumptionData] = useState<number[]>([]);
  const [additionalData, setAdditionalData] = useState<number[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<string>('last_year');
  const [dateArray, setDateArray] = useState<string[]>([]);
  let startDate;

  const generateData = () => {
    const newData = Math.floor(Math.random() * (200 - 50 + 1)) + 50;
    return newData;
  };

  const generateDateRange = (timeRange: string) => {
    const now = new Date();
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
    };
  };
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
  const fetchData = () => {
    const dateRange = generateDateRange(selectedTimeRange);
    let start_date = dateRange.start;
    let params = {
      consumer_id: props.context_id,
      start_date: start_date,
    };
    const url = `${process.env.NEXT_PUBLIC_API_URL}/retailer/consumption?consumer_id=${params.consumer_id}&start_date=${params.start_date}`;
    return url;
  };

  const { data, error } = useSWR(() => fetchData(), fetcher, {
    refreshInterval: 500000,
  });

  useEffect(() => {
    if (data) {
      const consumptionVal = data.energy.map((energy: any) => {
        return energy.amount;
      });

      const tempDateArray = data.energy.map((energy: any) => {
        return formatDate(energy.date);
      });

      setConsumptionData(consumptionVal);
      setDateArray(tempDateArray);
    }
  }, [data]);

  // useEffect(() => {
  //   const interval3 = setInterval(() => {
  //     setAdditionalData((prevData) => [...prevData, generateData()]);
  //   }, 5000);
  //   return () => clearInterval(interval3);
  // }, []);

  const handleTimeRangeChange = (value: string) => {
    setSelectedTimeRange(value);
  };

  return (
    <div>
      <div className="flex flex-grow justify-center items-center ">
        <div className="w-full bg-itembg border border-stroke rounded-lg p-4">
          <Dropdown
            onChange={handleTimeRangeChange}
            chartTitle={props.chartName}
          />
          <LineChart
            chartTitle=""
            xAxisLabels={dateArray}
            datasets={[
              {
                label: 'Consumtion',
                data: consumptionData,
                borderColor: 'purple',
                backgroundColor: 'white',
              },
            ]}
            xAxisTitle="Date"
            yAxisTitle="Amount (KWH)"
          />
        </div>
      </div>
      <div className="mt-4 mx-auto w-1/2"></div>
    </div>
  );
}

export default ConsumerEnergyChart;

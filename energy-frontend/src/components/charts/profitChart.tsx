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
  const [dateArray, setDateArray] = useState<string[]>([]);

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
  const formatDate = (isoString) => {
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
    const url = `${process.env.NEXT_PUBLIC_API_URL}/retailer/profitMargin?start_date=${params.start_date}`;
    return url;
  };
  const { data, error } = useSWR(() => fetchData(), fetcher, {
    refreshInterval: POLLING_RATE,
  });

  //uncomment below when backend is up

  useEffect(() => {
    if (data) {
      // Extract the spot prices, selling prices, and dates
      const spotPrices = data.spot_prices.map((price: any) => price.amount);
      const sellingPrices = data.selling_prices.map(
        (price: any) => price.amount
      );
      const dates = data.selling_prices.map((price: any) =>
        formatDate(price.date)
      );

      // Calculate the profit data
      const profitData = sellingPrices.map((sellingPrice, index) => {
        const spotPrice = spotPrices[index];
        return sellingPrice - (spotPrice || 0); // Subtract spot price if available, otherwise use 0
      });

      // Set the state for each data array
      setSpotPriceData(spotPrices);
      setSellingPriceData(sellingPrices);
      setProfitData(profitData);
      setDateArray(dates); // Assuming you have a state variable to track the X-axis values

      console.log('Spot Prices:', spotPrices);
      console.log('Selling Prices:', sellingPrices);
      console.log('Profit Data:', profitData);
      console.log('Dates:', dates);
    }
  }, [data]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newSpotPrice = generateData();
      const newSellingPrice = generateData();
      const newProfit = newSellingPrice - newSpotPrice;

      setProfitData((prevData) => [...prevData, newProfit]);
      setSpotPriceData((prevData) => [...prevData, newSpotPrice]);
      setSellingPriceData((prevData) => [...prevData, newSellingPrice]);
    }, 50000);
    return () => clearInterval(interval);
  }, []);

  const handleTimeRangeChange = (value: string) => {
    setSelectedTimeRange(value);
  };

  return (
    <div
      className={`w-full bg-itembg border border-stroke rounded-lg p-4 ${props.className ? props.className : ''}`}
    >
      <div className="justify-center items-center">
        <div className="drop-shadow-md border-chartBorder ">
          <Dropdown
            onChange={handleTimeRangeChange}
            chartTitle={'Profit Analysis'}
          />
          <LineChart
            chartTitle=""
            // xAxisLabels={spotPriceData.map((_, index) => `Day ${index + 1}`)}
            xAxisLabels={dateArray}
            datasets={[
              {
                label: 'Profit (AUD)',
                data: profitData,
                borderColor: 'purple',
                backgroundColor: 'white',
              },
              {
                label: 'Spot Price (AUD) ',
                data: spotPriceData,
                borderColor: 'red',
                backgroundColor: 'white',
              },
              {
                label: 'Selling Price (AUD)',
                data: sellingPriceData,
                borderColor: 'blue',
                backgroundColor: 'white',
              },
            ]}
            xAxisTitle="Date"
            yAxisTitle="Value (AUD)"
          />
        </div>
      </div>
    </div>
  );
}

export default ProfitChart;

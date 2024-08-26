'use client';
import React, { useEffect, useState } from 'react';
import Dropdown from './dropDownFilter'; // Adjust the path based on your folder structure
import LineChart from './lineChart';
import axios from 'axios';

function EnergyChart(props: {
  className: string;
  isSuburb?: boolean;
  isConsumer?: boolean;
  context_id: string;
}) {
  const [consumptionData, setConsumptionData] = useState<number[]>([]);
  const [generationData, setGenerationData] = useState<number[]>([]);
  const [additionalData, setAdditionalData] = useState<number[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<string>('last_year');

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

  const fetchData = async () => {
    const dateRange = generateDateRange(selectedTimeRange);
    let start_date = dateRange.start;
    let end_date = dateRange.end;
    let params;

    if (props.isConsumer) {
      params = {
        consumer_id: props.context_id,
        start_date: start_date,
        end_date: end_date,
      };
    } else if (props.isSuburb) {
      params = {
        suburb_id: props.context_id,
        start_date: start_date,
        end_date: end_date,
      };
    } else {
      params = {
        start_date: start_date,
        end_date: end_date,
      };
    }

    try {
      const response = await axios.get(
        'http://localhost:3000/retailer/consumption',
        { params }
      );
      const consumption = response.data.energy.map((item: any) => item.amount);
      setConsumptionData(consumption);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    const interval2 = setInterval(() => {
      setGenerationData((prevData) => [...prevData, generateData()]);
    }, 50000);
    return () => clearInterval(interval2);
  }, []);

  useEffect(() => {
    const interval3 = setInterval(() => {
      setAdditionalData((prevData) => [...prevData, generateData()]);
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

  const datasets = props.isConsumer
    ? [
        {
          label: 'Energy Consumption',
          data: consumptionData,
          borderColor: 'red',
          backgroundColor: 'white',
        },
      ]
    : [
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
            chartTitle={props.className}
          />
          <LineChart
            chartTitle=""
            xAxisLabels={consumptionData.map((_, index) => `Day ${index + 1}`)}
            datasets={datasets}
            xAxisTitle="Day"
            yAxisTitle="Amount"
          />
        </div>
      </div>
      <div className="mt-4 mx-auto w-1/2"></div>
    </div>
  );
}

export default EnergyChart;

'use client';
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import Dropdown from './dropDownFilter';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Dataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
}

interface Props {
  chartTitle: string;
  xAxisLabels?: string[];
  datasets: Dataset[];
  xAxisTitle: string;
  yAxisTitle: string;
  showDateRangeDropdown: boolean;
  onDateRangeChange: (value: string) => void;
}

const LineChart: React.FC<Props> = ({
  chartTitle,
  xAxisLabels,
  datasets,
  xAxisTitle,
  yAxisTitle,
  showDateRangeDropdown,
  onDateRangeChange,
}) => {
  const [chartData, setChartData] = useState({
    labels: xAxisLabels,
    datasets: datasets.map((dataset) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.borderColor || 'white',
      backgroundColor: 'white',
    })),
  });

  useEffect(() => {
    setChartData({
      labels: xAxisLabels,
      datasets: datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.data,
        borderColor: dataset.borderColor || 'red',
        backgroundColor: 'white',
      })),
    });
  }, [xAxisLabels, datasets]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'white', // Set legend text color to white
        },
      },
      title: {
        display: true,
        color: 'white', // Set title text color to white
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        ticks: {
          color: 'white', // Set x-axis tick text color to white
        },
        title: {
          display: true,
          text: xAxisTitle,
          color: 'white', // Set x-axis title text color to white
        },
      },
      y: {
        type: 'linear' as const,
        ticks: {
          color: 'white', // Set y-axis tick text color to white
        },
        title: {
          display: true,
          text: yAxisTitle,
          color: 'white', // Set y-axis title text color to white
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.2)', // Set y-axis gridlines color to white with opacity
        },
        border: {
          dash: [3, 3],
        },
      },
    },
  };

  return (
    <div className="flex flex-grow">
      <div className="flex flex-row justify-between w-100 bg-green-500">
        <p className=" text-white font-semibold pt-4 px-2">{chartTitle}</p>
        <div>
          {showDateRangeDropdown && onDateRangeChange ? (
            <Dropdown onChange={onDateRangeChange} />
          ) : null}
        </div>
      </div>
      <Line
        options={options}
        data={chartData}
      />
    </div>
  );
};

export default LineChart;

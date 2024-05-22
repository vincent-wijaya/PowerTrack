"use client";
import React, { useEffect, useState } from "react";
import "chartjs-adapter-date-fns"
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Dataset {
  label: string;
  data: {x:Date,y:number}[];
  borderColor: string;
  backgroundColor: string;
}

interface Props {
  chartTitle: string;
  xAxisLabels?: string[];
  datasets: Dataset[];
  xAxisTitle: string;
  yAxisTitle: string;
}

const LineChart: React.FC<Props> = ({
  chartTitle,
  xAxisLabels,
  datasets,
  xAxisTitle,
  yAxisTitle,
}) => {
  const [chartData, setChartData] = useState({
    datasets: datasets.map((dataset) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.borderColor || "white",
      backgroundColor: "white",
    })),
  });

  useEffect(() => {
    setChartData({
      datasets: datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.data,
        borderColor: dataset.borderColor || "red",
        backgroundColor: "white",
      })),
    });
  }, [xAxisLabels, datasets]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "white", // Set legend text color to white
        },
      },
      title: {
        display: true,
        text: chartTitle,
        color: "white", // Set title text color to white
      },
    },
    scales: {
      x: {
        type: "time" as const,
        time: {
          round:"second"
        },
        title: {
          display: true,
          text: xAxisTitle,
          color: "white", // Set x-axis title text color to white
        },
      },
      y: {
        type: "linear" as const,
        ticks: {
          color: "white", // Set y-axis tick text color to white
        },
        title: {
          display: true,
          text: yAxisTitle,
          color: "white", // Set y-axis title text color to white
        },
        grid: {
          color: "rgba(255, 255, 255, 0.2)", // Set y-axis gridlines color to white with opacity
        },
        border: {
          dash: [3, 3],
        },
      },
    },
  };

  return (
    <div className="flex-grow">
      <Line options={options} data={chartData} />;
    </div>
  );
};

export default LineChart;

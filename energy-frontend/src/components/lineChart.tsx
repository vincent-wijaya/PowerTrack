"use client";
import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

interface Props {
  chartTitle: string;
  xAxisLabels?: string[];
  dataset1Label: string;
  dataset1Data: number[];
  dataset1Color?: string;
  dataset2Label: string;
  dataset2Data: number[];
  dataset2Color?: string;
  xAxisTitle: string;
  yAxisTitle: string;
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export function LineChart({
  chartTitle,
  xAxisLabels,
  dataset1Label,
  dataset1Data,
  dataset1Color,
  dataset2Label,
  dataset2Data,
  dataset2Color,
  xAxisTitle,
  yAxisTitle,
}: Props) {
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
        type: "category" as const,
        ticks: {
          color: "white", // Set x-axis tick text color to white
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
  const data = {
    labels: xAxisLabels,
    datasets: [
      {
        label: dataset1Label,
        data: dataset1Data,
        borderColor: dataset1Color,
        backgroundColor: "white",
      },
      {
        label: dataset2Label,
        data: dataset2Data,
        borderColor: dataset2Color,
        backgroundColor: "white",
      },
    ],
  };

  return (
    <div className="flex flex-grow">
      <Line options={options} data={data} />
    </div>
  );
}

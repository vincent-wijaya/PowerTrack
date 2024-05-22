"use client";
import React, { useEffect, useState } from "react";
import Dropdown from "./dropDownFilter"; // Adjust the path based on your folder structure
import LineChart from "./lineChart";
type ChartEntry = {
  x: Date, y: number
}
function EnergyChart(props: { className?: string }) {
  const [consumptionData, setConsumptionData] = useState<ChartEntry[]>([]);
  const [generationData, setGenerationData] = useState<ChartEntry[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("last_year");

  const generateData = (): ChartEntry => ({ x: new Date(), y: Math.floor(Math.random() * (200 - 50 + 1)) + 50 });


  const fetchData = async () => {
    // Logic to fetch data based on selectedTimeRange
    // Adjust the fetching logic based on the selected time range
  };

  useEffect(() => {
    const interval1 = setInterval(() => {
      setConsumptionData((prevData) => [...prevData, generateData()]);
    }, 10000);
    return () => clearInterval(interval1);
  }, []);

  useEffect(() => {
    const interval2 = setInterval(() => {
      setGenerationData((prevData) => [...prevData, generateData()]);
    }, 10000);
    return () => clearInterval(interval2);
  }, []);

  useEffect(() => {
    // Fetch data when selectedTimeRange changes
    fetchData();
  }, [selectedTimeRange]);

  const handleTimeRangeChange = (value: string) => {
    setSelectedTimeRange(value);
  };

  return (
    <div className={`bg-itembg border border-stroke rounded-lg p-4 ${props.className ? props.className : ""}`}>
      <div className="justify-center items-center">
        <div className="drop-shadow-md border-chartBorder ">
          <Dropdown onChange={handleTimeRangeChange} chartTitle={"Energy Consumption/Generation"} />
          <LineChart
            chartTitle=""
            xAxisLabels={consumptionData.map((_, index) => `Day ${index + 1}`)}
            datasets={[
              {
                label: "Energy Consumption",
                data: consumptionData,
                borderColor: "red",
                backgroundColor: "white",
              },
              {
                label: "Energy Generation",
                data: generationData,
                borderColor: "blue",
                backgroundColor: "white",
              },
            ]}
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

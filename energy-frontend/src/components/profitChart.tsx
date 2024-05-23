"use client";
import React, { useEffect, useState } from "react";
import Dropdown from "./dropDownFilter"; // Adjust the path based on your folder structure
import LineChart from "./lineChart";
type ChartEntry = {
  x: Date, y: number
}
function ProfitChart(props: { className?: string }) {
  const [profitData, setProfitData] = useState<ChartEntry[]>([]);
  const [spotPriceData, setSpotPriceData] = useState<ChartEntry[]>([]);
  const [sellingPriceData, setSellingPriceData] = useState<ChartEntry[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("last_year");
  let timestamps = { spot: undefined, sell: undefined }

  useEffect(() => {
    const interval2 = setInterval(() => {
      fetch("http://54.197.122.32:3001/retailer/profitMargin")
        .then(response => response.json())
        .then(res => {
          console.log(res)
          if (res.spot_prices.length === 0 || res.selling_prices.length === 0) {
            return
          }
          let selling = res.selling_prices.pop()
          let spot = res.spot_prices.pop()

          if (selling.date === timestamps.sell && spot.date === timestamps.spot) {
            return // we have already compared these two so we skip
          }
          timestamps.spot = spot.date
          timestamps.sell = selling.date
          setSpotPriceData((prevData) => [...prevData, { x: new Date(spot.date), y: spot.amount }]);
          setSellingPriceData((prevData) => [...prevData, { x: new Date(selling.date), y: selling.amount }]);
          setProfitData((prevData) => [...prevData, { x: new Date(spot.date), y: selling.amount - spot.amount }]);
        })
        .catch(reason => console.log(reason))
    }, 5000);
    return () => clearInterval(interval2);
  }, []);

  const handleTimeRangeChange = (value: string) => {
    setSelectedTimeRange(value);
  };

  return (
    <div className={`bg-itembg border border-stroke rounded-lg p-4 ${props.className ? props.className : ""}`}>
      <div className="justify-center items-center">
        <div className="drop-shadow-md border-chartBorder ">
          <Dropdown onChange={handleTimeRangeChange} chartTitle={"Profit Analysis"} />
          <LineChart
            chartTitle=""
            xAxisLabels={profitData.map((_, index) => `Day ${index + 1}`)}
            datasets={[
              {
                label: "Profit",
                data: profitData,
                borderColor: "purple",
                backgroundColor: "white",
              },
              {
                label: "Spot Price",
                data: spotPriceData,
                borderColor: "red",
                backgroundColor: "white",
              },
              {
                label: "Selling Price",
                data: sellingPriceData,
                borderColor: "blue",
                backgroundColor: "white",
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

import React from "react";
import PageHeading from "@/components/pageHeading";
import { LineChart } from "@/components/lineChart";


export default function WarningsPage() {
  // Example data for the LineChart component
  const chartTitle = "Warnings Chart";
  const xAxisLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const dataset1Label = "Warnings";
  const dataset1Data = [12, 15, 20, 18, 25, 22, 30]; // Example warning counts
  const dataset1Color = "rgb(255, 99, 132)";
  const dataset2Label = "Errors";
  const dataset2Data = [8, 10, 12, 15, 18, 20, 22]; // Example error counts
  const dataset2Color = "rgb(54, 162, 235)";
  const yAxisTitle = "Count";
  const xAxisTitle = "Months";

  return (
    <>

      <div className="flex flex-col-2">
        <PageHeading title="Warnings" />
      </div>
      <div>
        {/* <InfoBox title="X Urgent Warnings" description="of all warnings" />*/}
      </div>
      <div className="flex justify-center items-center w-screen h-screen">
        <div className="w-1/2 h-1/2 drop-shadow-md border-2 border-chartBorder">
          <LineChart
            chartTitle={chartTitle}
            xAxisLabels={xAxisLabels}
            dataset1Label={dataset1Label}
            dataset1Data={dataset1Data}
            dataset1Color={dataset1Color}
            dataset2Label={dataset2Label}
            dataset2Data={dataset2Data}
            dataset2Color={dataset2Color}
            yAxisTitle={yAxisTitle}
            xAxisTitle={xAxisTitle}
          />
        </div>
  

        </div>
      </>
  );
}

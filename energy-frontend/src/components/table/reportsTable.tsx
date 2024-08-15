'use client';
import React, { useEffect, useState } from "react";
import Table from "./table"; // Adjust the import path according to your project structure
import fetchReports from "@/api/getReports"; // Adjust the import path according to your project structure

type ReportItem = {
  start_date: string;
  end_date: string;
  suburb_id: number;
  consumer_id: number | null;
};


// Mock function to fetch headers and data
async function fetchHeadersAndData(): Promise<{ headers: string[], data: ReportItem[] }> {
  const dataItems: ReportItem[] = [];

  try {
    const reports = await fetchReports();

    reports.forEach((report) => {
      const dataItem: ReportItem = {
        start_date: report.start_date,
        end_date: report.end_date,
        suburb_id: report.for.suburb_id,
        consumer_id: report.for.consumer_id,
      };
      dataItems.push(dataItem);
    });
    console.log(dataItems)

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          headers: ["consumer_id", "suburb_id", "start_date", "end_date"],
          data: dataItems
        });
      }, 1000); // Simulating network delay
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw error; // Rethrow the error or handle it appropriately
  }
}

export default function ReportsTable({ id }: ReportsTableProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<ReportItem[]>([]);

  useEffect(() => {
    async function getData() {
      try {
        const { headers, data } = await fetchHeadersAndData();
        setHeaders(headers);
        setData(data);
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    }

    // Initial fetch
    getData();

    // Set up polling
    const interval = setInterval(() => {
      getData();
    }, 50000); // Adjust the interval as needed

    // Clean up interval on component unmount
    return () => clearInterval(interval);
  }, [])

  return (
    <Table columns={headers} data={data} link={'/main/individualReport'} />
  );
}

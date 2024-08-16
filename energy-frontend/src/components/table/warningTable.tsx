"use client";
import React, { useEffect, useState } from "react";
import Table from "./table";
import fetchWarnings from "@/api/getWarnings";

type DataItem = {
  suburb_id: number;
  consumer_id: number;
  goal: string;
  category: string;
  description: string;
  suggestion: string;
  data: {};
};

interface WarningTableProps {
  suburb_id?: number;
  consumer_id?: number;

}


// Mock function to fetch headers and data
// Mock function to fetch headers and data
async function fetchHeadersAndData(suburb_id? :number, consumer_id?: number): Promise<{ headers: string[], data: DataItem[] }> {
    // Initialize an array to store DataItem objects
  const dataItems: DataItem[] = [];

  try {

    const warningsResult = await fetchWarnings(suburb_id, consumer_id);
  
    // Check if warningsResult is an object with 'warnings' property or directly an array
    const warnings = Array.isArray(warningsResult) ? warningsResult : warningsResult.warnings;

    
    // Map the warnings into DataItem format
    const mappedDataItems: DataItem[] = warnings.map((warning) => ({
      suburb_id: suburb_id ?? 0, // Assuming 0 if suburb_id is not provided
      consumer_id: warning.data.consumer_id,
      goal: 'Goal Placeholder', // Replace with actual goal if available
      category: warning.category,
      description: warning.description,
      suggestion: warning.suggestion,
      data: warning.data
    }));
    
    // Add the mapped DataItem objects to dataItems array
    dataItems.push(...mappedDataItems);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          headers: ["Description", "Goal", "Suggestion"],
          data: dataItems
        });
      }, 1000); // Simulating network delay
    });
  } catch (error) {
    console.error('Error fetching warning data:', error);
    throw error; // Rethrow the error or handle it appropriately
  }
}


export default function WarningTable({ suburb_id, consumer_id }: WarningTableProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<DataItem[]>([]);


  useEffect(() => {
    async function getData() {
      try {
        const { headers, data } = await fetchHeadersAndData(suburb_id, consumer_id);
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
        <Table columns={headers} data={data} link={null}/>
    )
}
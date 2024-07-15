"use client";
import React, { useEffect, useState } from "react";
import Table from "./table";
import fetchWarnings from "@/api/getWarnings";

type DataItem = {
  id: number;
  goal: string;
  category: string;
  description: string;
  suggestion: string;
  data: {};
};

interface WarningTableProps {
  id?: number;
}

// Define a type or interface for your warning object
interface Warning {
  id: number;
  goal: string;
  category: string;
  description: string;
  suggestion: string;
  data: {}; // Adjust this based on the actual structure of 'data' in 'warning'
}

// Mock function to fetch headers and data
// Mock function to fetch headers and data
async function fetchHeadersAndData(id?: number): Promise<{ headers: string[], data: DataItem[] }> {
    // Initialize an array to store DataItem objects
  const dataItems: DataItem[] = [];

  try {

    const warningsResult = await fetchWarnings(id);

    // Check if warningsResult is an object with 'warnings' property or directly an array
    const warnings = Array.isArray(warningsResult) ? warningsResult : warningsResult.warnings;



    // Loop through each warning in warnings array
    warnings.forEach((warning: Warning) => {
      // Adjust DataItem structure to match the properties of 'warning'
      const dataItem: DataItem = {
        id: warning.id,
        goal: warning.goal,
        category: warning.category,
        description: warning.description,
        suggestion: warning.suggestion,
        data: warning.data // Adjust this based on the actual structure of 'data' in 'warning'
      };
      // Push the constructed dataItem into dataItems array
      dataItems.push(dataItem);
  });
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          headers: ["Category", "Description", "Goal", "Suggestion"],
          data: dataItems
        });
      }, 1000); // Simulating network delay
    });
  } catch (error) {
    console.error('Error fetching warning data:', error);
    throw error; // Rethrow the error or handle it appropriately
  }
}


export default function WarningTable({ id }: WarningTableProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<DataItem[]>([]);


  useEffect(() => {
    async function getData() {
      try {
        const { headers, data } = await fetchHeadersAndData(id);
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
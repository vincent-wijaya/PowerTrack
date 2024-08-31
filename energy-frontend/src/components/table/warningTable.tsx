'use client';
import React, { useEffect, useState } from 'react';
import Table from './table';
import fetchWarnings from '@/api/getWarnings';
import axios from 'axios';

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
async function fetchHeadersAndData(
  suburb_id?: number,
  consumer_id?: number
): Promise<{ headers: { name: string; title: string }[]; data: DataItem[] }> {
  // Initialize an array to store DataItem objects
  const dataItems: DataItem[] = [];

  let link = `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings`

  if (suburb_id) {
    link = `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings?suburb_id=${suburb_id}`
  } else if(consumer_id) {
    link  = `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings?consumer_id=${consumer_id}`
  }

  try {
    const warningsResult = await axios.get(
      link
    );

    // Access the warnings array directly
    const warnings = warningsResult.data.warnings;

    // Ensure warnings is an array before mapping
    const mappedDataItems: DataItem[] = Array.isArray(warnings)
      ? warnings.map((warning: any) => ({
          suburb_id: suburb_id ?? 0, // Assuming 0 if suburb_id is not provided
          consumer_id: warning.data.consumer_id,
          goal: 'Goal Placeholder', // Replace with actual goal if available
          category: warning.category,
          description: warning.description,
          suggestion: warning.suggestion,
          data: warning.data,
        }))
      : [];

    dataItems.push(...mappedDataItems);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          headers: [
            {
              name: 'description',
              title: 'Description',
            },
            {
              name: 'goal',
              title: 'Goal',
            },
            {
              name: 'suggestion',
              title: 'Suggestion',
            },
          ],
          data: dataItems,
        });
      }, 1000); // Simulating network delay
    });
  } catch (error) {
    console.error('Error fetching warning data:', error);
    throw error; // Rethrow the error or handle it appropriately
  }
}

export default function WarningTable({
  suburb_id,
  consumer_id,
}: WarningTableProps) {
  const [headers, setHeaders] = useState<{ name: string; title: string }[]>([]);
  const [data, setData] = useState<DataItem[]>([]);

  useEffect(() => {
    async function getData() {
      try {
        const { headers, data } = await fetchHeadersAndData(
          suburb_id,
          consumer_id
        );
        setHeaders(headers);
        setData(data);
      } catch (error) {
        console.error('Failed to fetch data', error);
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
  }, []);

  return (
    <Table
      columns={headers}
      data={data}
      link={null}
      showPageControls={false}
    />
  );
}

'use client';
import React from 'react';
import useSWR from 'swr';
import Table from './table';
import { fetcher } from '@/utils'; // Assuming this is where your fetcher is defined
import axios from 'axios';

type DataItem = {
  id: number;
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
async function fetchHeadersAndData(
  suburb_id?: number,
  consumer_id?: number
): Promise<{ headers: { name: string; title: string }[]; data: DataItem[] }> {
  // Initialize an array to store DataItem objects
  const dataItems: DataItem[] = [];

  let link = `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings`;

  if (suburb_id) {
    link = `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings?suburb_id=${suburb_id}`;
  } else if (consumer_id) {
    link = `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings?consumer_id=${consumer_id}`;
  }

  try {
    const warningsResult = await axios.get(link);

    // Access the warnings array directly
    const warnings = warningsResult.data.warnings;

    // Ensure warnings is an array before mapping
    const mappedDataItems: DataItem[] = Array.isArray(warnings)
      ? warnings.map((warning: any) => ({
          id: warning.data.id,
          suburb_id: suburb_id ?? 0, // Assuming 0 if suburb_id is not provided
          consumer_id: warning.data.consumer_id,
          goal: warning.goal, // Replace with actual goal if available
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
            // {
            //   name: 'goal',
            //   title: 'Goal',
            // },
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
  // Construct the query parameters dynamically
  const params = new URLSearchParams();
  if (suburb_id) params.append('suburb_id', suburb_id.toString());
  if (consumer_id) params.append('consumer_id', consumer_id.toString());

  // Generate the full URL with optional parameters
  const url = `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings`;

  const { data, error } = useSWR(url, fetcher, {
    refreshInterval: 50000, // Adjust the polling interval as needed
  });

  if (error) {
    console.error('Failed to fetch data', error);
    return <div className="text-white">Failed to load data</div>;
  }

  if (!data) {
    return <div className="text-white">Loading...</div>;
  }

  const headers = [
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
  ];

  let warningsData: DataItem[];

  warningsData = data.warnings.map((warning: any) => ({
    category: warning.category,
    description: warning.description,
    suggestion: warning.suggestion,
  }));

  return (
    <Table
      columns={headers}
      data={warningsData}
      link={null}
      showPageControls={false}
    />
  );
}

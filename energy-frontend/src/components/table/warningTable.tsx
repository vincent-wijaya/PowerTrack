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

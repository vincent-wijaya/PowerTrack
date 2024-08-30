'use client';
import React, { useEffect, useState } from 'react';
import Table from './table';
import axios from 'axios';
import { DateTime } from 'luxon';
import PageHeading from '../pageHeading';

type ReportsFetchType = {
  id: string;
  start_date: string;
  end_date: string;
  for: {
    suburb_id: number;
    consumer_id: number | null;
  };
};

interface ReportItem {
  id: string;
  start_date: string;
  end_date: string;
  suburb_id: number;
  consumer_id: number | null;
}

// Function to fetch headers and data
async function fetchHeadersAndData(): Promise<{
  headers: { name: string; title: string }[];
  data: ReportItem[];
}> {
  const response = await axios.get(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/reports`
  );

  const reports: ReportsFetchType[] = response.data.reports;

  const mappedDataItems: ReportItem[] = reports.map((report) => ({
    id: report.id,
    start_date: DateTime.fromISO(report.start_date).toFormat('D'),
    end_date: DateTime.fromISO(report.end_date).toFormat('D'),
    suburb_id: report.for.suburb_id,
    consumer_id: report.for.consumer_id,
  }));

  return {
    headers: [
      { name: 'id', title: 'ID' },
      { name: 'suburb_id', title: 'Suburb ID' },
      { name: 'consumer_id', title: 'Consumer ID' },
      { name: 'start_date', title: 'Start Date' },
      { name: 'end_date', title: 'End Date' },
    ],
    data: mappedDataItems,
  };
}

export default function ReportsTable() {
  const [headers, setHeaders] = useState<{ name: string; title: string }[]>([]);
  const [data, setData] = useState<ReportItem[]>([]);
  const [filteredData, setFilteredData] = useState<ReportItem[]>([]);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    async function getData() {
      try {
        const { headers, data } = await fetchHeadersAndData();
        setHeaders(headers);
        setData(data);
        setFilteredData(data);
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

  useEffect(() => {
    // Filter data based on search input
    const lowercasedSearch = search.toLowerCase().trim();
    const filtered = data.filter(
      (item: ReportItem) =>
        item.id.toString().trim().toLowerCase().includes(lowercasedSearch) ||
        item.suburb_id.toString().trim().toLowerCase().includes(lowercasedSearch)
    );
    setFilteredData(filtered);
  }, [search, data]);

  return (
    <div>
      <PageHeading title="Reports" />
      <div>
        <input
          type="text"
          className="flex w-full p-2 bg-itembg border border-chartBorder text-white"
          placeholder="Search by ID or Suburb ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Table
        columns={headers}
        data={filteredData}
        link={'/main/individualReport'}
        showPageControls={true}
      />
    </div>
  );
}

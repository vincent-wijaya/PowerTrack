'use client';
import React, { useEffect, useState } from 'react';
import Table from './table';
import fetchSuburbs from '@/api/getSuburbs';

type DataItem = {
  sal: number;
  name: string;
  postcode: number;
};

// Mock function to fetch headers and data
async function fetchHeadersAndData(): Promise<{
  headers: string[];
  data: DataItem[];
}> {
  const dataItems: DataItem[] = [];
  const data = await fetchSuburbs();

  // Map the warnings into DataItem format
  const mappedDataItems: DataItem[] = data.suburbs.map((suburb) => ({
    sal: suburb.id,
    name: suburb.name,
    postcode: suburb.postcode,
  }));

  // Add the mapped DataItem objects to dataItems array
  dataItems.push(...mappedDataItems);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        headers: ['sal', 'name', 'postcode'], //TODO change suburb and sal the other way
        data: dataItems,
      });
    }, 1000); // Simulating network delay
  });
}

export default function RegionalTable() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<DataItem[]>([]);
  const [filteredData, setFilteredData] = useState<DataItem[]>([]);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    async function getData() {
      try {
        const { headers, data } = await fetchHeadersAndData();
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

  useEffect(() => {
    // Filter data based on search input
    const lowercasedSearch = search.toLowerCase().trim();
    const filtered = data.filter((item) =>
      item.name.toString().toLowerCase().includes(lowercasedSearch)
    );
    setFilteredData(filtered);
    console.log('Filtered:', filtered);
  }, [search, data]);

  return (
    <div>
      <div>
        <input
          type="text"
          className="flex w-full p-2 bg-itembg border border-chartBorder text-white"
          placeholder="Search by suburb name or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Table
        columns={headers}
        data={filteredData}
        link={'userDashboard'}
      />
    </div>
  );
}

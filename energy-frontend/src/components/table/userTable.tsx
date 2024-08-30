'use client';
import React, { useEffect, useState } from 'react';
import Table from './table';
import axios from 'axios';

type DataItem = {
  consumer_id: number;
  suburb_name: string;
  address: string;
  high_priority: string;
};

// function to fetch headers and data
async function fetchHeadersAndData(): Promise<{
  headers: { name: string; title: string }[];
  data: DataItem[];
}> {
  const dataItems: DataItem[] = [];
  const response = await axios.get(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/consumers`
  );

  const consumers = response.data.consumers;

  // Map the warnings into DataItem format
  const mappedDataItems: DataItem[] = consumers.map((consumer: any) => ({
    consumer_id: consumer.id,
    suburb_name: consumer.suburb_name,
    address: consumer.address,
    high_priority: consumer.high_priority ? 'Yes' : 'No',
  }));

  // Add the mapped DataItem objects to dataItems array
  dataItems.push(...mappedDataItems);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        headers: [
          {
            name: 'consumer_id',
            title: 'Consumer ID',
          },
          {
            name: 'suburb_name',
            title: 'Suburb Name',
          },
          {
            name: 'address',
            title: 'Address',
          },
          {
            name: 'high_priority',
            title: 'High Priority',
          },
        ], //TODO change suburb and sal the other way
        data: dataItems,
      });
    }, 1000); // Simulating network delay
  });
}

export default function UserTable() {
  const [headers, setHeaders] = useState<{ name: string; title: string }[]>([]);
  const [data, setData] = useState<DataItem[]>([]);
  const [filteredData, setFilteredData] = useState<DataItem[]>([]);
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
      (item: DataItem) =>
        item.consumer_id.toString().trim().toLowerCase().includes(lowercasedSearch) ||
        item.address.toString().trim().toLowerCase().includes(lowercasedSearch)
    );
    setFilteredData(filtered);
  }, [search, data]);

  return (
    <div>
      <div>
        <input
          type="text"
          className="flex w-full p-2 bg-itembg border border-chartBorder text-white"
          placeholder="Search by consumer ID or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Table
        columns={headers}
        data={filteredData}
        link={'userDashboard'}
        showPageControls={true}
      />
    </div>
  );
}

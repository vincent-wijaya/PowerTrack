"use client";
import React, { useEffect, useState } from "react";
import Table from "./table";
import fetchConsumers from "@/api/getConsumers";

type DataItem = {
  consumer_id: number;
  suburb_name: string;
  address: string;
  high_priority: boolean;
};


// function to fetch headers and data
async function fetchHeadersAndData(): Promise<{ headers: string[], data: DataItem[] }> {
  const dataItems: DataItem[] = [];
  const data = await fetchConsumers()
  // Map the warnings into DataItem format
  const mappedDataItems: DataItem[] = data.consumer.map((consume) => ({
    consumer_id: consume.consumer_id,
    suburb_name: consume.suburb_name,
    address: consume.address,
    high_priority: consume.high_priority,
  }));
  
  // Add the mapped DataItem objects to dataItems array
  dataItems.push(...mappedDataItems);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        headers: ["consumer_id", "suburb_name", "address", "high_priority"], //TODO change suburb and sal the other way
        data: dataItems
      });
    }, 1000); // Simulating network delay
  });
}


export default function UserTable() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<DataItem[]>([]);
  const [filteredData, setFilteredData] = useState<DataItem[]>([]);
  const [search, setSearch] = useState<string>("");


  useEffect(() => {
    async function getData() {
      try {
        const { headers, data } = await fetchHeadersAndData();
        setHeaders(headers);
        setData(data);
        setFilteredData(data)
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


  useEffect(() => {
    // Filter data based on search input
    const lowercasedSearch = search.toLowerCase().trim();
    const filtered = data.filter(item =>
      item.consumer_id.toString().toLowerCase().includes(lowercasedSearch) ||
      item.address.toString().toLowerCase().includes(lowercasedSearch)
    );
    setFilteredData(filtered);
  }, [search, data]);


    return (
      <div>
      <div>
      <input 
        type="text" 
        className="flex w-full p-2 bg-itembg border border-chartBorder text-white"
        placeholder="Search by consumer id or address..." 
        value={search} 
        onChange={(e) => setSearch(e.target.value)}  
      />
      </div>
      <Table columns={headers} data={filteredData} link={'userDashboard'}/>
    </div>
    )
}
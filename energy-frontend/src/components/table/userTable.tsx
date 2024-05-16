"use client";
import React, { useEffect, useState } from "react";
import Table from "./table";

type DataItem = {
  id: number;
  priority: boolean;
  address: string;
};


// Mock function to fetch headers and data
async function fetchHeadersAndData(): Promise<{ headers: string[], data: DataItem[] }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        headers: ["id", "priority", "address"],
        data: [
          { id: 1, priority: true, address: "54, Dawes Road" },
          { id: 2, priority: false, address: "6 Sunnsyside Road" },
          { id: 3, priority: true, address: "Central" }
        ]
      });
    }, 1000); // Simulating network delay
  });
}


export default function UserTable() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<DataItem[]>([]);


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
        <Table columns={headers} data={data} link={'userDashboard'}/>
    )
}
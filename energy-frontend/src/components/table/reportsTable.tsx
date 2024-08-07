'use client';
import React from "react";
import useSWR from "swr";
import Table from "./table"; // Adjust the import path according to your project structure
import { fetcher } from "@/utils"; // Ensure fetcher is correctly defined in your utils
import { POLLING_RATE } from "@/config"; // Ensure POLLING_RATE is defined in your config

export type ReportsFetchType = {
  start_date: string;
  end_date: string;
  for: {
    suburb_id: number;
    consumer_id: number | null;
  };
};

interface ReportItem {
  start_date: string;
  end_date: string;
  suburb_id: number;
  consumer_id: number | null;
}

export default function ReportsTable() {
  const { data, error } = useSWR<ReportsFetchType[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/reports`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );
  console.log(data)
  if (error) return <div className="text-white">Failed to load data</div>;
  if (!data) return <div className="text-white">Loading...</div>;

  // Transform data for the table
  const transformedData: ReportItem[] = data.map((report) => ({
    start_date: report.start_date,
    end_date: report.end_date,
    suburb_id: report.for.suburb_id,
    consumer_id: report.for.consumer_id,
  }));

  const headers = ["start_date", "end_date", "suburb_id", "consumer_id"];

  return (
    <Table columns={headers} data={transformedData} link={'/main/individualReport'} />
  );
}
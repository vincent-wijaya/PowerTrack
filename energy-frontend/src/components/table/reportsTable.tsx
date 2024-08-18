'use client';
import React from "react";
import Table from "./table"; // Adjust the import path according to your project structure
import { DateTime } from 'luxon';
import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWR from "swr";

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

export default function ReportsTable() {
  // Use SWR for data fetching
  const { data, error } = useSWR<{ reports: ReportsFetchType[] }>(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/reports`,
    fetcher,
    { refreshInterval: POLLING_RATE }
  );

  console.log("REPORTS", data)
  // Transform the fetched data for the table
  const transformedData: ReportItem[] = data && Array.isArray(data.reports)
    ? data.reports.map((report) => ({
        id: report.id,
        start_date: DateTime.fromISO(report.start_date).toFormat('D'),
        end_date: DateTime.fromISO(report.end_date).toFormat('D'),
        suburb_id: report.for.suburb_id,
        consumer_id: report.for.consumer_id,
      }))
    : [];

  if (!data && !error) return <div className="text-white">Loading...</div>;
  if (error) return <div className="text-white">Error: {error.message}</div>;

  const headers = ["id", "Suburb ID", "consumer ID", "Start Date", "End Date"];

  return (
    <Table columns={headers} data={transformedData} link={'/main/individualReport'} />
  );
}

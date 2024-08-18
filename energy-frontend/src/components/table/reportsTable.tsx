'use client';
import React from "react";
import Table from "./table"; // Adjust the import path according to your project structure
import { DateTime } from 'luxon';
import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWR from "swr";
import fetchReports from "@/api/getReports";

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
    //`${process.env.NEXT_PUBLIC_API_URL}/retailer/reports`,
    //fetcher,
    //{ refreshInterval: POLLING_RATE }
    'reports',
    fetchReports,
    {refreshInterval : 0}
  );

  console.log("REPORTS", data)
  // Transform the fetched data for the table
  // TODO, replace data w/ data.reports in lines 44 & 45


  const transformedData: ReportItem[] = data && Array.isArray(data)
    ? data.map((report) => ({
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

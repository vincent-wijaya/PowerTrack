'use client';
import React, { useState, useEffect } from "react";
import Table from "./table"; // Adjust the import path according to your project structure
import fetchReports from "@/api/getReports";

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
  const [data, setData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const reports = await fetchReports();
        // Transform data for the table
        const transformedData: ReportItem[] = reports.map((report) => ({
          start_date: report.start_date,
          end_date: report.end_date,
          suburb_id: report.for.suburb_id,
          consumer_id: report.for.consumer_id,
        }));
        setData(transformedData);
      } catch (err) {
        console.error("Failed to fetch reports:", err);
        setError("Failed to fetch reports");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []); // Empty dependency array means this runs once on mount

  if (loading) return <div className="text-white">Loading...</div>;
  if (error) return <div className="text-white">Error: {error}</div>;

  const headers = ["suburb_id", "consumer_id", "start_date", "end_date"];

  return (
    <Table columns={headers} data={data} link={'/main/individualReport'} />
  );
}

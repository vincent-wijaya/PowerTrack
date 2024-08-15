'use client'
import fetchEnergyConsumption from "@/api/energyConsumption";
import fetchReport from "@/api/getReport";
import Headings from "@/app/main/template";
import EnergyChart from "@/components/energyChart";
import EnergySourceBreakdown from '@/components/energySourceBreakdown';
import InfoBox from "@/components/infoBox";
import PageHeading from "@/components/pageHeading";
import ProfitChart from "@/components/profitChart";
import ProfitMargin from "@/components/profitMargin";
import WarningTable from "@/components/table/warningTable";
import { POLLING_RATE } from "@/config";
import { fetcher } from "@/utils";
import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";


export default function IndividualReport({ params }: { params: { id: string } }) {
    const reportId = parseInt(params.id, 10);
    const { data, error } = useSWR(`report-${reportId}`, () => fetchReport(reportId));

    if (error) return <div>Error loading report.</div>;
    if (!data) return <div>Loading...</div>;
    if (data === null) return <div>No report found.</div>;
    return (
      <div className="text-white grid grid-cols-2 grid-rows-[min-content_1fr_1fr_min-content] gap-3 grid-flow-col">
        <PageHeading title={`Report ${data.id}`} />

        <div className="col-span-2">
          <InfoBox title="Report Details">
            <p>Start Date: {data.start_date}</p>
            <p>End Date: {data.end_date}</p>
            <p>Suburb ID: {data.for.suburb_id}</p>
          </InfoBox>
        </div>
        <EnergySourceBreakdown energySources={energySourceBreakdownMockData} />
      </div>
    );
}



const energySourceBreakdownMockData = [
  {
    category: 'Fossil Fuels',
    renewable: false,
    percentage: 0.1033,
    count: 148,
  },
  {
    category: 'Renewable',
    renewable: true,
    percentage: 0.0419,
    count: 67,
  },
  {
    category: 'Renewable',
    renewable: true,
    percentage: 0.0419,
    count: 67,
  },
  {
    category: 'Renewable',
    renewable: true,
    percentage: 0.0419,
    count: 67,
  },
  {
    category: 'Renewable',
    renewable: true,
    percentage: 0.0419,
    count: 67,
  },
  {
    category: 'Renewable',
    renewable: true,
    percentage: 0.0419,
    count: 67,
  },
];

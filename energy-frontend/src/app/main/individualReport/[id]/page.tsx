'use client';
import fetchEnergyConsumption from '@/api/energyConsumption';
import fetchReport from '@/api/getReport';
import Headings from '@/app/main/template';
import EnergyChart from '@/components/energyChart';
import EnergySourceBreakdown from '@/components/energySourceBreakdown';
import InfoBox from '@/components/infoBox';
import PageHeading from '@/components/pageHeading';
import ProfitChart from '@/components/profitChart';
import ProfitMargin from '@/components/profitMargin';
import WarningTable from '@/components/table/warningTable';
import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import { DateTime } from 'luxon';
import { useState, useEffect, useMemo } from 'react';
import { exportToPDF } from '@/utils'; // Import the utility function
import useSWR from 'swr';


interface Report {
  id: number;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  for: {
    suburb_id: number;
    consumer_id: number | null;
  };
  energy: Array<{
    start_date: string; // ISO date string
    end_date: string; // ISO date string
    consumption: number;
    generation: number;
  }>;
  selling_price: Array<{
    date: string; // ISO date string
    amount: number;
  }>;
  spot_price: Array<{
    date: string; // ISO date string
    amount: number;
  }>;
  sources: Array<{
    category: string;
    renewable: boolean;
    percentage: number;
    total: number;
    count: number;
  }>;
}

interface SuburbData {
  id: string;
  latitude: string;
  longitude: string;
  name: string;
  postcode: number;
  state: string;
}

interface Consumer {
  suburb_id: number;
  suburb_name: string;
  suburb_post_code: string;
  id: number;
  address: string;
  high_priority: boolean;
}

interface ConsumerResponse {
  consumers: Consumer[];
}

export default function IndividualReport({
  params,
}: {
  params: { id: string };
}) {
  const mainurl = process.env.NEXT_PUBLIC_API_URL;
  const reportId = parseInt(params.id, 10);
  const averageProfitkwh = '$0.40';
  const averagePM = '10%';
  const greenEnergyGoal = '20%';
  const greenEnergyUsage = '76%';
  const profitted = '$1000';
  const revenue = '$10,000';
  const spendage = '$9000';


  const [title, setTitle] = useState('')

  // Fetch the report here
  const { data, error } = useSWR<Report>(
    `${mainurl}/retailer/reports/${reportId}`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  const suburbId = data?.for.suburb_id;
  const consumerId = data?.for.consumer_id;

  const { data: suburbData, error: suburbError } = useSWR<SuburbData>(
    suburbId ? `${mainurl}/retailer/suburbs/${suburbId}` : null,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  const consumerID = data?.for.consumer_id;
  const { data: consumerData, error: consumerError } = useSWR<ConsumerResponse>(
    consumerId ? `${mainurl}/retailer/consumers?consumer_id=${consumerID}` : null,
    fetcher,
    {
      refreshInterval: 0,
    }
  );


  // Set the data to display for suburb case here
  useEffect(() => {
    // Handle the suburb cases here:
    if (data?.for.consumer_id === null && suburbData) {
      setTitle(`${suburbData.name}, ${suburbData.postcode}, ${suburbData.state}`);
    }

  }, [data, suburbData]);
  


  // Set the data to display for consumer case here
  useEffect(() => {
    // Handle the suburb cases here:
    if (data?.for.consumer_id && consumerData) {
      const consumer = consumerData.consumers[0]
      setTitle(`${consumer.address}, ${consumer.suburb_post_code}`);
    }

  }, [data, consumerData]);

  if (error) return <div>Error loading report.</div>;
  if (!data) return <div className="text-white">Loading...</div>;
  if (data === null) return <div>No report found.</div>;

  return (
    <div
      className="bg-bgmain"
      id="contentToExport"
    >
      <PageHeading title='REPORT' />
      
      <div className="text-white py-2">
        {DateTime.fromISO(data.start_date).toFormat('D')} -{' '}
        {DateTime.fromISO(data.end_date).toFormat('D')}
        <br></br>
        {title}
      </div>
      <div className="grid grid-flow-col grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between gap-3 h-[128px]">
            <InfoBox
              title={averageProfitkwh}
              description="Average Profit per kwh sold when bought"
            />
            <InfoBox
              title={averagePM}
              description="Average Profit Margin"
            />
            <InfoBox
              title={greenEnergyGoal}
              description="Of green energy goal met"
            />
            <InfoBox
              title={greenEnergyUsage}
              description="Green Energy Usage"
            />
            <InfoBox
              title={profitted}
              description="Profitted"
            />
            <InfoBox
              title={revenue}
              description="Revenue made"
            />
            <InfoBox
              title={spendage}
              description="Money Spent on energy"
            />
          </div>
          <EnergySourceBreakdown energySources={data.sources} />
          <button
            onClick={() => exportToPDF('contentToExport')}
            className="p-4 w-full h-1/4 bg-purple text-white text-center rounded-lg mt-4"
          >
            Export to PDF
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <EnergyChart className="" />
          <ProfitChart />
        </div>
        {/* <div className="p-4 bg-itembg border border-stroke rounded-lg">
          <EnergyChart />
        </div>
        <div className="p-4 bg-itembg border border-stroke rounded-lg">
          <ProfitChart />
        </div> */}
      </div>

      {/* <div className="h-screen px-10 grid grid-cols-2 gap-8 py-10">
        <div className="gap-8 py-10">
          <div className="h-1/6 gap-2 grid grid-cols-3">
            <InfoBox title="48%" description="of green energy goal met" />
            <InfoBox title="3" description="Warnings" />
            <InfoBox title="3" description="Suggestions" />
          </div>
          <div className="h-1/3 mt-8 p-4 bg-itembg border border-stroke rounded-lg">
            <Map />
          </div>
          <div className="h-1/3 gap-2 py-10">
            <WarningTable />
          </div>
        </div>
        <div className="gap-8 py-10">
          <div className="ml-8 p-4 bg-itembg border border-stroke rounded-lg">
            <EnergyChart />
          </div>
          <div className="ml-8 mt-4 p-4 bg-itembg border border-stroke rounded-lg">
            <ProfitChart />
          </div>
        </div>
      </div> */}
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

'use client'

import PageHeading from '@/components/pageHeading';
import InfoBox from '@/components/infoBox';
import Map from '@/components/map';
import WarningTable from '@/components/table/warningTable';
import EnergyChart from '@/components/energyChart';
import ProfitChart from '@/components/profitChart';
import ReportFormButton from '@/components/reportFormButton';
import axios from 'axios';
import { fetcher } from '@/utils';
import useSWR from 'swr';

export default function MainDashboard() {


  // Access the warnings array directly
  const { data: warningData, error: warningError } = useSWR(
   `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings`,
    fetcher,
    {
      refreshInterval: 0,
    }

  ); 
  console.log(warningData)

  return (
    <>
      <PageHeading title="Home" />
      <div className="flex gap-6"> {/* Container for left and right columns */}
        {/* Left column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex justify-between gap-3 h-[128px]">
            <InfoBox
              title="48%"
              description="of green energy goal met"
            />
            <InfoBox
              title={`${warningData?.warnings?.length || 0} Warnings`}
              description=""
            />
            <InfoBox
              title={`${warningData?.warnings?.length || 0} Suggestions`}
              description=""
            />
          </div>
          <Map className="h-[400px]" />
          <WarningTable />
        </div>        

        {/* Right column of page */}
        <div className="flex flex-col gap-3 flex-1">
          {/* <EnergyChart className="h-[300px]" /> */}
          <ProfitChart />
        </div>
      </div>
    </>
  );
}


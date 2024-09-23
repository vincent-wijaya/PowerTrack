'use client';

import dynamic from 'next/dynamic';

import PageHeading from '@/components/pageHeading';
import InfoBox from '@/components/infoBoxes/infoBox';
// import Map from '@/components/map';
import WarningTable from '@/components/tables/warningTable';
import EnergyChart from '@/components/charts/energyChart';
import ProfitChart from '@/components/charts/profitChart';
import ReportFormButton from '@/components/reportFormButton';
import axios from 'axios';
import { fetcher } from '@/utils';
import useSWR from 'swr';
import GreenGoal from '@/components/infoBoxes/greenGoal';
import GreenUsage from '@/components/infoBoxes/greenUsage';
import BuyPrice from '@/components/infoBoxes/buyPrice';

// Dynamically import the Map component with SSR disabled
const Map = dynamic(() => import('@/components/map'), { 
  ssr: false,
  loading: () => <p>Loading map...</p>
});

export default function MainDashboard() {
  // Access the warnings array directly
  const { data: warningData, error: warningError } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings`,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  return (
    <>
      <PageHeading title="Home" />
      <div className="flex gap-6">
        {' '}
        {/* Container for left and right columns */}
        {/* Left column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex justify-between gap-3 h-[128px]">
            <BuyPrice />
            <GreenGoal />
            <GreenUsage />
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
          <EnergyChart
            chartTitle="Nationwide Energy Consumption/Generation"
            context_id="Nation"
          />
          <ProfitChart />
        </div>
      </div>
    </>
  );
}

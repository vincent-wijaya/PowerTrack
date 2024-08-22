'use client';

import { useRouter } from 'next/router';
import PageHeading from '@/components/pageHeading';
import InfoBox from '@/components/infoBox';
import WarningTable from '@/components/table/warningTable';
import EnergyChart from '@/components/energyChart';
import ProfitChart from '@/components/profitChart';
import BuyPrice from '@/components/buyPrice';

import { useEffect, useState } from 'react';

export default function MainDashboard({
  params,
}: {
  params: { consumer_id: string };
}) {
  const consumerId = parseInt(params.consumer_id);

  return (
    <>
      <PageHeading title={`User ID - ${consumerId}`} />

      <div className="grid grid-flow-col grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between gap-3 h-[128px]">
            <BuyPrice />
            <InfoBox
              title="48%"
              description="of green energy goal met"
            />
            <InfoBox
              title="1 Warnings"
              description=""
            />
            <InfoBox
              title="1 Suggestions"
              description=""
            />
          </div>
          <WarningTable consumer_id={consumerId} />
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
    </>
  );
}

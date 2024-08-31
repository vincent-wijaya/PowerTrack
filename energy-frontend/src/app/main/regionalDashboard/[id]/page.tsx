'use client';
'use client';

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
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import ReportFormButton from '@/components/reportFormButton';

type ProfitMarginFetchType = {
  spot_prices: { date: string; amount: number }[];
  selling_prices: { date: string; amount: number }[];
};

export default function RegionalDashboard({
  params,
}: {
  params: { id: string };
}) {
  const { data: profitMarginFetch }: { data: ProfitMarginFetchType } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/profitMargin`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  function calculateProfitMargin(
    profitMarginFetch: ProfitMarginFetchType
  ): number {
    if (!profitMarginFetch) return 0;
    const lastSpotPrice = profitMarginFetch.spot_prices.at(-1)?.amount;
    const lastSellingPrice = profitMarginFetch.selling_prices.at(-1)?.amount;
    if (lastSpotPrice === undefined || lastSellingPrice === undefined) {
      return 0;
    } else {
      return Math.round(
        ((lastSellingPrice - lastSpotPrice) / lastSellingPrice) * 100
      );
    }
  }
  const currentSpotPrice =
    profitMarginFetch?.spot_prices?.at(-1)?.amount?.toLocaleString('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }) || '$0.00';

  return (
    <>
      <PageHeading title={`User ID: ${params.id}`} />

      <div className="flex gap-6"> {/* Flex container for left and right columns */}
        {/* Left column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex justify-between gap-3 h-[128px]">
          <InfoBox
              title={currentSpotPrice}
              description="Price of electricity per kW/h"
            />
            <InfoBox
              title="20%"
              description="Of green energy goal met"
            />
            <InfoBox
              title="1"
              description="Warnings"
            />
          </div>
          <WarningTable suburb_id={Number(params.id)} />
          <EnergySourceBreakdown energySources={energySourceBreakdownMockData} />
        </div>

        {/* Right column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <ProfitChart />
          <ProfitChart />
        </div>
      </div>

      <ReportFormButton
        id={params.id}
        type="suburb"
      />
    </>
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

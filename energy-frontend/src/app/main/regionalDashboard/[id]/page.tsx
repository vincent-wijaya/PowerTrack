'use client';
'use client';

import Headings from '@/app/main/template';
import EnergyChart from '@/components/charts/energyChart';
import EnergySourceBreakdown from '@/components/energySourceBreakdown';
import InfoBox from '@/components/infoBoxes/infoBox';
import PageHeading from '@/components/pageHeading';
import ProfitMargin from '@/components/infoBoxes/profitMargin';
import ProfitChart from '@/components/charts/profitChart';
import WarningTable from '@/components/tables/warningTable';
import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import ReportFormButton from '@/components/reportFormButton';

type ProfitMarginFetchType = {
  spot_prices: { date: string; amount: number }[];
  selling_prices: { date: string; amount: number }[];
};

interface SuburbData {
  id: string;
  latitude: string;
  longitude: string;
  name: string;
  postcode: number;
  state: string;
}

export default function RegionalDashboard({
  params,
}: {
  params: { id: string };
}) {
  const { data: suburbData, error: suburbError } = useSWR<SuburbData>(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/suburbs/${params.id}`,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

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

  const { data: warningData, error: warningError } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings?suburb_id=${params.id}`,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  return (
    <>
      <PageHeading
        title={`${suburbData?.name}, ${suburbData?.postcode}, ${suburbData?.state}`}
      />

      <div className="flex gap-6">
        {' '}
        {/* Flex container for left and right columns */}
        {/* Left column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex justify-between gap-3 h-[128px]">
            <InfoBox
              title={currentSpotPrice}
              description="Price of electricity per kWh"
            />
            <InfoBox
              title={`${warningData?.warnings?.length || 0} Warnings`}
              description=""
            />
          </div>
          <WarningTable suburb_id={Number(params.id)} />
          <EnergySourceBreakdown
            energySources={energySourceBreakdownMockData}
          />
        </div>
        {/* Right column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <ProfitChart />
          <EnergyChart
            chartTitle="Suburb Energy Consumption/Generation"
            context_id={params.id}
          />
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
    category: 'Solar',
    renewable: true,
    percentage: 0.0419,
    count: 67,
  },
  {
    category: 'Landfill Gas',
    renewable: false,
    percentage: 0.0419,
    count: 67,
  },
  {
    category: 'Diesel',
    renewable: false,
    percentage: 0.0419,
    count: 67,
  },
  {
    category: 'Water',
    renewable: true,
    percentage: 0.0419,
    count: 67,
  },
  {
    category: 'Biogas',
    renewable: false,
    percentage: 0.0419,
    count: 67,
  },
];

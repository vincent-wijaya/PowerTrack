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
import { fetcher, generateDateRange } from '@/utils';
import useSWR from 'swr';
import GreenGoal from '@/components/infoBoxes/greenGoal';
import GreenUsage from '@/components/infoBoxes/greenUsage';
import BuyPrice from '@/components/infoBoxes/buyPrice';
import { DropdownOption } from '@/components/charts/dropDownFilter';
import { fetchProfitMargin } from '@/api/getProfitMargin';
import { useState } from 'react';
import { fetchEnergyConsumption } from '@/api/getEnergyConsumption';
import { fetchEnergyGeneration } from '@/api/getEnergyGeneration';
import { fetchSources } from '@/api/getSources';
import EnergySourceBreakdown from '@/components/energySourceBreakdown';
import RenewableGenerationChart from '@/components/charts/renewableGenerationChart';

// Dynamically import the Map component with SSR disabled
const Map = dynamic(() => import('@/components/map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>,
});

export default function MainDashboard() {
  const [energySourcesDateRange, setEnergySourcesDateRange] = useState<{
    start: string;
    end: string;
  }>(generateDateRange('last_year'));
  const [energyChartDateRange, setEnergyChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year'));
  const [profitChartDateRange, setProfitChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year'));

  // Access the warnings array directly
  const { data: warningData, error: warningError } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings`,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  const energyConsumptionData = fetchEnergyConsumption(
    energyChartDateRange.start,
    energyChartDateRange.end
  );
  const energyGenerationData = fetchEnergyGeneration(
    energyChartDateRange.start,
    energyChartDateRange.end
  );

  const profitMarginData = fetchProfitMargin(
    profitChartDateRange.start,
    profitChartDateRange.end
  );

  const onEnergyChartDateRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setEnergyChartDateRange(dateRange);
  };

  const onProfitChartDateRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setProfitChartDateRange(dateRange);
  };

  const energySources = fetchSources(
    energySourcesDateRange.start,
    energySourcesDateRange.end
  );

  const onEnergySourceTimeRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setEnergySourcesDateRange(dateRange);
  };

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
          <EnergySourceBreakdown
            chartTitle="Nationwide Energy Generation Source Breakdown"
            energySources={energySources?.sources}
            onTimeRangeChange={onEnergySourceTimeRangeChange}
            showTimeRangeDropdown={true}
          />
        </div>
        {/* Right column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <EnergyChart
            chartTitle="Nationwide Energy Consumption/Generation"
            energyConsumptionData={energyConsumptionData}
            energyGenerationData={energyGenerationData}
            onTimeRangeChange={onEnergyChartDateRangeChange}
            showTimeRangeDropdown={true}
            granularity={energyChartDateRange.granularity}
          />
          <ProfitChart
            chartTitle="Nationwide Profit Analysis"
            profitMarginData={profitMarginData}
            onTimeRangeChange={onProfitChartDateRangeChange}
            showTimeRangeDropdown={true}
            granularity={profitChartDateRange.granularity}
          />

          <RenewableGenerationChart
            chartTitle="Nationwide Renewable Energy Generation"
            energyGenerationData={energyGenerationData}
            onTimeRangeChange={onEnergyChartDateRangeChange}
            showTimeRangeDropdown={true}
            granularity={energyChartDateRange.granularity}
          />
        </div>
      </div>
    </>
  );
}

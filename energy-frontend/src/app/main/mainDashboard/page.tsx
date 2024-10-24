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

// Dynamically import the Map component with client-side rendering only (ssr: false)
// While loading, display the message "Loading map..."
const Map = dynamic(() => import('@/components/map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>,
});

export default function MainDashboard() {
  // Set default date ranges for energy sources, energy chart, and profit chart using a utility function
  const [energySourcesDateRange, setEnergySourcesDateRange] = useState<{
    start: string;
    end: string;
  }>(generateDateRange('last_year')); // Default to the last year

  const [energyChartDateRange, setEnergyChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year')); // Default energy chart range to the last year

  const [profitChartDateRange, setProfitChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year')); // Default profit chart range to the last year

  // Fetch warning data using SWR hook, data is not auto-refreshed (refreshInterval: 0)
  const { data: warningData, error: warningError } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings`,
    fetcher,
    {
      refreshInterval: 0, // No polling, fetch data only once
    }
  );

  // Fetch energy consumption data for the current energy chart date range
  const energyConsumptionData = fetchEnergyConsumption(
    energyChartDateRange.start
  );

  // Fetch energy generation data for the current energy chart date range
  const energyGenerationData = fetchEnergyGeneration(
    energyChartDateRange.start
  );

  // Fetch profit margin data for the current profit chart date range
  const profitMarginData = fetchProfitMargin(profitChartDateRange.start);

  // Handle changes in the energy chart date range (e.g., when the user selects a different range)
  const onEnergyChartDateRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value); // Generate the new date range based on user selection
    setEnergyChartDateRange(dateRange); // Update the state with the new range
  };

  // Handle changes in the profit chart date range
  const onProfitChartDateRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value); // Generate the new date range based on user selection
    setProfitChartDateRange(dateRange); // Update the state with the new range
  };

  // Fetch energy sources data for the current energy sources date range
  const energySources = fetchSources(energySourcesDateRange.start);

  // Handle changes in the energy sources time range (e.g., when the user selects a different time range)
  const onEnergySourceTimeRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value); // Generate the new date range based on user selection
    setEnergySourcesDateRange(dateRange); // Update the state with the new range
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
          <div className="flex flex-col justify-center p-4 w-full bg-itembg border border-stroke rounded-lg text-left space-y-2">
            <div className="text-white w-full text-left font-bold">
              Warnings
            </div>
            <WarningTable />
          </div>
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
            energyConsumptionData={energyConsumptionData?.energy}
            energyGenerationData={energyGenerationData?.energy}
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
            energyGenerationData={energyGenerationData?.energy}
            onTimeRangeChange={onEnergyChartDateRangeChange}
            showTimeRangeDropdown={true}
            granularity={energyChartDateRange.granularity}
          />
        </div>
      </div>
    </>
  );
}

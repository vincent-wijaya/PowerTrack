'use client';
'use client';

import EnergyChart from '@/components/charts/energyChart';
import EnergySourceBreakdown from '@/components/energySourceBreakdown';
import InfoBox from '@/components/infoBoxes/infoBox';
import PageHeading from '@/components/pageHeading';
import ProfitChart from '@/components/charts/profitChart';
import WarningTable from '@/components/tables/warningTable';
import { POLLING_RATE } from '@/config';
import { fetcher, generateDateRange } from '@/utils';
import useSWR from 'swr';
import ReportFormButton from '@/components/reportFormButton';
import { EnergySources, fetchSources } from '@/api/getSources';
import { DropdownOption } from '@/components/charts/dropDownFilter';
import RenewableGenerationChart from '@/components/charts/renewableGenerationChart';

import { useEffect, useState } from 'react';
import { fetchProfitMargin } from '@/api/getProfitMargin';
import { fetchEnergyConsumption } from '@/api/getEnergyConsumption';
import { fetchEnergyGeneration } from '@/api/getEnergyGeneration';

// Interface for the suburb data with details like location, priority consumers, etc.
interface SuburbData {
  id: string;
  latitude: string;
  longitude: string;
  name: string;
  postcode: number;
  state: string;
  highPriorityConsumers: number;
  lowPriorityConsumers: number;
}

// RegionalDashboard component that takes params (including suburb id)
export default function RegionalDashboard({
  params,
}: {
  params: { id: string };
}) {
  // State for managing date ranges related to energy sources data
  const [energySourcesDateRange, setEnergySourcesDateRange] = useState<{
    start: string;
    end: string;
  }>(generateDateRange('last_year'));

  // State for managing date ranges for energy consumption chart
  const [energyChartDateRange, setEnergyChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year'));

  // State for managing date ranges for profit chart
  const [profitChartDateRange, setProfitChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year'));

  // State for holding the spot price, initialized as 'N/A'
  const [spotPrice, setSpotPrice] = useState('N/A');

  // Fetch energy consumption data for the suburb based on the chart date range and suburb id
  const energyConsumptionData = fetchEnergyConsumption(
    energyChartDateRange.start,
    params.id,
    'suburb'
  );

  // Fetch energy generation data for the suburb based on the chart date range and suburb id
  const energyGenerationData = fetchEnergyGeneration(
    energyChartDateRange.start,
    params.id,
    'suburb'
  );

  // Event handler for updating the energy chart date range
  const onEnergyChartDateRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setEnergyChartDateRange(dateRange);
  };

  // Event handler for updating the profit chart date range
  const onProfitChartTimeRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setProfitChartDateRange(dateRange);
  };

  // Fetch profit margin data based on the current profit chart date range
  const profitMarginData = fetchProfitMargin(profitChartDateRange.start);

  // Use SWR to fetch data related to the specific suburb (by id) for the dashboard
  const { data: suburbData, error: suburbError } = useSWR<SuburbData>(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/suburbs/${params.id}`,
    fetcher,
    {
      refreshInterval: 0, // No automatic refresh
    }
  );

  // Fetch energy sources data for the suburb based on the selected date range
  const energySources = fetchSources(
    energySourcesDateRange.start,
    params.id,
    'suburb'
  );

  // Event handler for updating the energy sources date range
  const onEnergySourceTimeRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setEnergySourcesDateRange(dateRange);
  };

  // useEffect hook to update the spot price based on the latest fetched profit margin data
  useEffect(() => {
    const currentSpotPrice =
      profitMarginData?.values.spot_prices
        ?.at(-1) // Get the latest spot price
        ?.amount?.toLocaleString('en-AU', {
          style: 'currency',
          currency: 'AUD',
        }) || 'N/A'; // Fallback to 'N/A' if data is unavailable

    setSpotPrice(currentSpotPrice); // Update the spot price state
  }, [profitMarginData]); // Dependency array, will run when profitMarginData changes

  // Fetch warning data for the suburb (by suburb_id) using SWR
  const { data: warningData, error: warningError } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings?suburb_id=${params.id}`,
    fetcher,
    {
      refreshInterval: 0, // No automatic refresh
    }
  );

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <PageHeading
            title={
              suburbData
                ? `${suburbData?.name}, ${suburbData?.postcode}, ${suburbData?.state}`
                : 'Loading...'
            }
          />
          <p className="text-sm">
            <span className="font-bold">
              {suburbData?.highPriorityConsumers ?? 0}
            </span>{' '}
            High Priority Users {'  '}|{'  '}
            <span className="font-bold">
              {suburbData?.lowPriorityConsumers ?? 0}
            </span>{' '}
            Low Priority Users
          </p>
        </div>
        <ReportFormButton
          id={params.id}
          type="suburb"
        />
      </div>

      <div className="flex gap-6">
        {' '}
        {/* Flex container for left and right columns */}
        {/* Left column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex justify-between gap-3 h-[128px]">
            <InfoBox
              title={spotPrice}
              description="Price of electricity per kWh"
            />
            <InfoBox
              title={`${warningData?.warnings?.length || 0} Warnings`}
              description=""
            />
          </div>
          <div className="flex flex-col justify-center p-4 w-full bg-itembg border border-stroke rounded-lg text-left space-y-2">
            <div className="text-white w-full text-left font-bold">
              Warnings
            </div>
            <WarningTable suburb_id={Number(params.id)} />
          </div>

          <EnergySourceBreakdown
            chartTitle={`${suburbData ? suburbData?.name + "'s " : ''}Energy Generation Source Breakdown`}
            energySources={energySources?.sources}
            onTimeRangeChange={onEnergySourceTimeRangeChange}
            showTimeRangeDropdown={true}
          />
        </div>
        {/* Right column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <EnergyChart
            chartTitle="Suburb Energy Consumption/Generation"
            energyConsumptionData={energyConsumptionData?.energy}
            energyGenerationData={energyGenerationData?.energy}
            onTimeRangeChange={onEnergyChartDateRangeChange}
            showTimeRangeDropdown={true}
            granularity={energyChartDateRange.granularity}
          />
          <ProfitChart
            chartTitle="Suburb Profit Analysis"
            profitMarginData={profitMarginData}
            onTimeRangeChange={onProfitChartTimeRangeChange}
            showTimeRangeDropdown={true}
            granularity={profitChartDateRange.granularity}
          />
          <RenewableGenerationChart
            chartTitle="Suburb Renewable Energy Generation"
            energyGenerationData={energyGenerationData?.energy}
            onTimeRangeChange={onEnergyChartDateRangeChange}
            showTimeRangeDropdown={true}
            granularity={energyChartDateRange.granularity}
          />
        </div>
      </div>
    </div>
  );
}

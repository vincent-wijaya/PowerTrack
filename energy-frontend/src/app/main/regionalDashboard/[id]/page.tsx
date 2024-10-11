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

export default function RegionalDashboard({
  params,
}: {
  params: { id: string };
}) {
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
  const [spotPrice, setSpotPrice] = useState('N/A');

  const energyConsumptionData = fetchEnergyConsumption(
    energyChartDateRange.start,
    params.id,
    'suburb'
  );
  const energyGenerationData = fetchEnergyGeneration(
    energyChartDateRange.start,
    params.id,
    'suburb'
  );

  const onEnergyChartDateRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setEnergyChartDateRange(dateRange);
  };

  const onProfitChartTimeRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setProfitChartDateRange(dateRange);
  };

  const profitMarginData = fetchProfitMargin(
    profitChartDateRange.start,
  );

  const { data: suburbData, error: suburbError } = useSWR<SuburbData>(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/suburbs/${params.id}`,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  const energySources = fetchSources(
    energySourcesDateRange.start,
    params.id,
    'suburb'
  );

  const onEnergySourceTimeRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setEnergySourcesDateRange(dateRange);
  };

  useEffect(() => {
    const currentSpotPrice =
      profitMarginData?.values.spot_prices
        ?.at(-1)
        ?.amount?.toLocaleString('en-AU', {
          style: 'currency',
          currency: 'AUD',
        }) || 'N/A';

    console.log(currentSpotPrice);

    setSpotPrice(currentSpotPrice);
  }, [profitMarginData]);

  const { data: warningData, error: warningError } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings?suburb_id=${params.id}`,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <PageHeading
            title={`${suburbData?.name}, ${suburbData?.postcode}, ${suburbData?.state}`}
          />
          <p className="text-sm">
            <span className="font-bold">
              {suburbData?.highPriorityConsumers}
            </span>{' '}
            High Priority Users {'  '}|{'  '}
            <span className="font-bold">
              {suburbData?.lowPriorityConsumers}
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
          <WarningTable suburb_id={Number(params.id)} />

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
            energyConsumptionData={energyConsumptionData}
            energyGenerationData={energyGenerationData}
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
            energyGenerationData={energyGenerationData}
            onTimeRangeChange={onEnergyChartDateRangeChange}
            showTimeRangeDropdown={true}
            granularity={energyChartDateRange.granularity}
          />
        </div>
      </div>
    </div>
  );
}

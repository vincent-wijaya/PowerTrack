'use client';

import Headings from '@/app/main/template';
import BuyPrice from '@/components/infoBoxes/buyPrice';
import GreenGoal from '@/components/infoBoxes/greenGoal';
import GreenUsage from '@/components/infoBoxes/greenUsage';
import InfoBox from '@/components/infoBoxes/infoBox';
import PageHeading from '@/components/pageHeading';
import ReportFormButton from '@/components/reportFormButton';
import WarningTable from '@/components/tables/warningTable';
import { fetcher, generateDateRange } from '@/utils';
import ConsumerSpendChart from '@/components/charts/consumerSpendChart';
import useSWR from 'swr';
import EnergySourceBreakdown from '@/components/energySourceBreakdown';
import { EnergySources, fetchSources } from '@/api/getSources';
import { useEffect, useState } from 'react';
import { DropdownOption } from '@/components/charts/dropDownFilter';
import EnergyChart from '@/components/charts/energyChart';
import { fetchEnergyConsumption } from '@/api/getEnergyConsumption';
import { POLLING_RATE } from '@/config';
import { fetchSpending } from '@/api/getSpending';

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

type Cluster = {
  consumers: Consumer[];
};

type PowerOutages = {
  clusters: Cluster[];
  consumers: Consumer[];
};

type OutageData = {
  power_outages: PowerOutages;
};

export default function UserDashboard({ params }: { params: { id: number } }) {
  const [energySourcesDateRange, setEnergySourcesDateRange] = useState<{
    start: string;
    end: string;
  }>(generateDateRange('last_year'));
  const [energyChartDateRange, setEnergyChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year'));
  const [spendingChartDateRange, setSpendingChartDateRange] = useState<{
    start: string;
    end: string;
    granularity: string;
  }>(generateDateRange('last_year'));

  const energyConsumptionData = fetchEnergyConsumption(
    energyChartDateRange.start,
    params.id,
    'consumer'
  );
  const url = process.env.NEXT_PUBLIC_API_URL;
  const { data: buyingPrice, error } = useSWR(
    `${url}/consumer/buyingPrice`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  const [buyPrce, setBuyPrce] = useState(0);

  useEffect(() => {
    if (!buyingPrice) return;
    setBuyPrce(buyingPrice.amount);
  }, [buyingPrice]);
  const onEnergyChartDateRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setEnergyChartDateRange(dateRange);
  };

  const stringID = params.id.toString();

  const { data: warningData, error: warningError } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings?consumer_id=${params.id}`,
    fetcher,
    {
      refreshInterval: 0,
    }
  );
  const { data: consumerData, error: consumerError } = useSWR<ConsumerResponse>(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/consumers?consumer_id=${params.id}`,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  const spendingData = fetchSpending(spendingChartDateRange.start, params.id);

  const onSpendingDateRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setSpendingChartDateRange(dateRange);
  };

  const energySources = fetchSources(
    energySourcesDateRange.start,
    params.id,
    'consumer'
  );

  const onEnergySourceDateRangeChange = (value: DropdownOption) => {
    const dateRange = generateDateRange(value);

    setEnergySourcesDateRange(dateRange);
  };

  let title;
  if (consumerData) {
    title = consumerData.consumers[0].address;
  } else {
    title = 'Loading...';
  }

  const { data: outageData }: { data: OutageData } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/powerOutages`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  const isConsumerInOutage = (
    consumerId: number,
    outageData: OutageData | undefined
  ): boolean => {
    if (!outageData) return false;

    const { power_outages } = outageData;
    const consumers = power_outages.consumers;
    const Id = Number(consumerId);

    // Check if consumer ID exists in the top-level consumers array
    let relevantConsumers = consumers.filter((consumer) => consumer.id === Id);
    return relevantConsumers.length === 1;
  };

  const isInOutage = isConsumerInOutage(params.id, outageData);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <PageHeading title={title} />
          {isInOutage && <div className="text-red font-bold">POWER OUTAGE</div>}
          {consumerData?.consumers?.[0]?.high_priority && (
            <div className="text-red text-left font-semibold">
              HIGH PRIORITY
            </div>
          )}
        </div>
        <ReportFormButton
          id={stringID}
          type="consumer"
        />
      </div>

      <div className="flex gap-6">
        {' '}
        {/* Flex container for left and right columns */}
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
          <div className="flex flex-col justify-center p-4 w-full bg-itembg border border-stroke rounded-lg text-left space-y-2">
            <div className="text-white w-full text-left font-bold">
              Warnings
            </div>
            <WarningTable consumer_id={params.id} />
          </div>
          <EnergySourceBreakdown
            chartTitle={`${consumerData ? consumerData?.consumers[0].suburb_name + "'s " : ''}Energy Generation Source Breakdown`}
            energySources={energySources?.sources}
            onTimeRangeChange={onEnergySourceDateRangeChange}
            showTimeRangeDropdown={true}
          />
        </div>
        {/* Right column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <EnergyChart
            chartTitle="Consumer Energy Consumption"
            energyConsumptionData={energyConsumptionData?.energy}
            onTimeRangeChange={onEnergyChartDateRangeChange}
            showTimeRangeDropdown={true}
            granularity={energyChartDateRange.granularity}
          />
          <ConsumerSpendChart
            chartTitle="Consumer Spending"
            spendingData={spendingData?.spending}
            onTimeRangeChange={onSpendingDateRangeChange}
            showTimeRangeDropdown={true}
            granularity={spendingChartDateRange.granularity}
          />

          {/* Uncomment and add styles for ConsumerEnergyChart if needed */}
          {/* <div className="p-4 bg-itembg border border-stroke rounded-lg">
            <ConsumerEnergyChart />
          </div> */}
        </div>
      </div>
    </div>
  );
}

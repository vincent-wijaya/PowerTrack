'use client';

import Headings from '@/app/main/template';
import ConsumerEnergyChart from '@/components/charts/consumerConsumptionChart';
import BuyPrice from '@/components/infoBoxes/buyPrice';
import GreenGoal from '@/components/infoBoxes/greenGoal';
import GreenUsage from '@/components/infoBoxes/greenUsage';
import InfoBox from '@/components/infoBoxes/infoBox';
import PageHeading from '@/components/pageHeading';
import ReportFormButton from '@/components/reportFormButton';
import WarningTable from '@/components/tables/warningTable';
import { fetcher } from '@/utils';
import ConsumerSpendChart from '@/components/charts/consumerSpendChart';
import useSWR from 'swr';
import EnergySourceBreakdown from '@/components/energySourceBreakdown';

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

export default function UserDashboard({ params }: { params: { id: number } }) {
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

  let title;
  if (consumerData) {
    title = consumerData.consumers[0].address;
  } else {
    title = 'Loading...';
  }

  return (
    <>
      <PageHeading title={title} />

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
          <WarningTable consumer_id={params.id} />
          <EnergySourceBreakdown
            energySources={energySourceBreakdownMockData}
          />
        </div>
        {/* Right column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <ConsumerSpendChart
            chartName="Spending"
            context_id={params.id.toString()}
            buyingPrice={0.31}
          />
          <ConsumerEnergyChart
            chartName="Consumer Consumption"
            context_id={params.id.toString()}
          />
          {/* Uncomment and add styles for ConsumerEnergyChart if needed */}
          {/* <div className="p-4 bg-itembg border border-stroke rounded-lg">
            <ConsumerEnergyChart />
          </div> */}
        </div>
      </div>

      <ReportFormButton
        id={stringID}
        type="consumer"
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

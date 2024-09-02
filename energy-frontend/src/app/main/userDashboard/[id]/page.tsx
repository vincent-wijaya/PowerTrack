'use client'

import Headings from '@/app/main/template';
import ConsumerEnergyChart from '@/components/consumerConsumptionChart';
import InfoBox from '@/components/infoBox';
import PageHeading from '@/components/pageHeading';
import ProfitChart from '@/components/profitChart';
import ReportFormButton from '@/components/reportFormButton';
import WarningTable from '@/components/table/warningTable';
import { fetcher } from '@/utils';
import useSWR from 'swr';

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
  
  let title
  if (consumerData) {
    title = consumerData.consumers[0].address
  } else {
    title = "Loading..."
  }
   
  return (
    <>
      <PageHeading title={title} />

      <div className="flex gap-6"> {/* Flex container for left and right columns */}
        {/* Left column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex justify-between gap-3 h-[128px]">
            <InfoBox
              title="48%"
              description="of green energy goal met"
            />
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
        </div>

        {/* Right column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <ProfitChart />
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

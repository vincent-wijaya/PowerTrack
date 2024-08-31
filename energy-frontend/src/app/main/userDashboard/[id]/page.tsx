import Headings from '@/app/main/template';
import ConsumerEnergyChart from '@/components/consumerConsumptionChart';
import InfoBox from '@/components/infoBox';
import PageHeading from '@/components/pageHeading';
import ProfitChart from '@/components/profitChart';
import ReportFormButton from '@/components/reportFormButton';
import WarningTable from '@/components/table/warningTable';

export default function UserDashboard({ params }: { params: { id: number } }) {
  const stringID = params.id.toString();
  return (
    <>
      <PageHeading title={`User ID -${params.id}`} />

      <div className="flex gap-6"> {/* Flex container for left and right columns */}
        {/* Left column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex justify-between gap-3 h-[128px]">
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
          <div className="p-4 bg-itembg border border-stroke rounded-lg">
            <WarningTable consumer_id={params.id} />
          </div>
        </div>

        {/* Right column of page */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="p-4 bg-itembg border border-stroke rounded-lg">
            <ProfitChart />
          </div>
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

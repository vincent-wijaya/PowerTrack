import PageHeading from '@/components/pageHeading';
import InfoBox from '@/components/infoBox';
import Map from '@/components/map';
import WarningTable from '@/components/table/warningTable';
import EnergyChart from '@/components/energyChart';
import ProfitChart from '@/components/profitChart';

export default function MainDashboard() {
  return (
    <>
      <PageHeading title="Home" />

      <div className="grid grid-flow-col grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
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
          <Map className="h-[400px]" />
          <WarningTable />
        </div>
        <div className="flex flex-col gap-3">
          <ProfitChart />
        </div>
      </div>
    </>
  );
}

'use client'

import Headings from "@/app/template";
import EnergyChart from "@/components/energyChart";
import InfoBox from "@/components/infoBox";
import PageHeading from "@/components/pageHeading";
import ProfitChart from "@/components/profitChart";
import WarningTable from "@/components/table/warningTable";

export default function RegionalDashboard({ params }: { params: { id: string } }) {
  return (
    <div className="grid grid-cols-2 grid-rows-[min-content_1fr_1fr_min-content] gap-3 grid-flow-col">
      <div>
        <div className="flex justify-between items-center mb-3">
          <PageHeading title={`Region - ${decodeURI(params.id)}`} />
          <div className="text-red-600 font-semibold text-xl">Power Outage</div>
        </div>
        <div className="flex justify-between gap-3">
          <InfoBox title="$0.00" description="Price of electricity per kW/h" />
          <InfoBox title="10%" description="Current Profit Margin" />
          <InfoBox title="20%" description="Of green energy goal met" />
          <InfoBox title="3" description="Warnings" />
        </div>
      </div>

      <EnergyChart />
      <ProfitChart />
      <WarningTable />
    </div>
  );
}
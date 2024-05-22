import PageHeading from "@/components/pageHeading";
import ProfitMargin from "@/components/profitMargin";

export default async function RegionalDashboard() {
  return (
    <>
      <div className="flex flex-col">
        <PageHeading title="Region" />

        <div className="flex mt-6">
          <ProfitMargin />
        </div>
      </div>
    </>
  );
}

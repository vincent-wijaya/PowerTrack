import Headings from "@/app/template";
import PageHeading from "@/components/pageHeading";
import ProfitMargin from "@/components/profitMargin";

const sampleProfitMarginFetchData = {
  profit: [
    {
      start_date: "2024-04-17T09:06:41Z",
      end_date: "2024-04-17T09:06:41Z",
      buy_price: 10,
      sell_price: 300,
    },
  ],
};


export default function RegionalDashboard() {
  return (
    <>
      <div className="flex flex-col">
        <PageHeading title="Region" />

        <div className="flex mt-6">
          {/* <InfoBox title="X Urgent Warnings" description="of all warnings" />*/}
          <ProfitMargin
            buyPrice={sampleProfitMarginFetchData.profit.at(-1)?.buy_price}
            sellPrice={sampleProfitMarginFetchData.profit.at(-1)?.sell_price}
          />
        </div>
      </div>
    </>
  );
}

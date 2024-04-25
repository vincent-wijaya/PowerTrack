import Headings from "@/app/template";
import PageHeading from "@/components/pageHeading";

export default function regionalDashboard() {
  return (
    <>
      <div className="flex flex-col-2">
        <PageHeading title="Region" />

        <div>{/* <InfoBox title="X Urgent Warnings" description="of all warnings" />*/}</div>
      </div>
    </>
  );
}

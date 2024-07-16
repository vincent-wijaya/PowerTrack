import PageHeading from "@/components/pageHeading";

export default function UserDashboard() {
  return (
    <>
      <div className="flex flex-col-2">
        <PageHeading title={`User `} />

        <div>{/* <InfoBox title="X Urgent Warnings" description="of all warnings" />*/}</div>
      </div>
    </>
  );
}

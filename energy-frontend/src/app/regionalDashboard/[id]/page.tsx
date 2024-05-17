'use client'

import Headings from "@/app/template";
import PageHeading from "@/components/pageHeading";

export default function RegionalDashboard({ params }: {
    params: {id: string};
}) {
  
  return (
    <>
      <div className="flex flex-col-2">
      <PageHeading title={`Region - ${params.id}`} />
        <div>{/* <InfoBox title="X Urgent Warnings" description="of all warnings" />*/}</div>
      </div>
    </>
  );
}
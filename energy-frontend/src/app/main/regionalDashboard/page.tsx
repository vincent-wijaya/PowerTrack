'use client'

import Headings from "@/app/template";
import PageHeading from "@/components/pageHeading";


export default function RegionalDashboard() {
  return (
    <>
      <div className="flex flex-col">
        <PageHeading title="Region" />

        <div>{/* <InfoBox title="X Urgent Warnings" description="of all warnings" />*/}</div>
      </div>
    </>
  );
}

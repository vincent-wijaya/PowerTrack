import React from "react";
import Headings from "@/app/template";
import InfoBox from "@/components/infoBox";
import PageHeading from "@/components/pageHeading";

export default function WarningsPage() {
  return (
    <>
      <div className="flex flex-col-2">
        <PageHeading title="Warnings"/>
        <div>{/* <InfoBox title="X Urgent Warnings" description="of all warnings" />*/}</div>
      </div>
    </>
  );
}

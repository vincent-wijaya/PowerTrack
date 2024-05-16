import React, { useEffect, useState } from "react";
import PageHeading from "@/components/pageHeading";
import EnergyChart from "@/components/energyChart";
import ProfitChart from "@/components/profitChart";
import Table from "@/components/table";

export default function WarningsPage() {
  const headers = ["id", "priority", "address"];
  const data = [
    { id: 1, priority: "High", address: "54, Dawes Road" },
    { id: 2, priority: "Low", address: "Review document B" },
    { id: 3, priority: "Medium", address: "Attend meeting C" }
  ];
  return (
   
    <>
      <div className="flex flex-col-2">
        <PageHeading title="Warnings" />
      </div>
      <Table columns={headers} data={data} link={true}/>
    </>
  );
}

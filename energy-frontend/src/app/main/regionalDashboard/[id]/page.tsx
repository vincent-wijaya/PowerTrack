'use client'

import Headings from "@/app/main/template";
import EnergyChart from "@/components/energyChart";
import InfoBox from "@/components/infoBox";
import PageHeading from "@/components/pageHeading";
import ProfitChart from "@/components/profitChart";
import ProfitMargin from "@/components/profitMargin";
import WarningTable from "@/components/table/warningTable";
import { POLLING_RATE } from "@/config";
import { fetcher } from "@/utils";
import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";

type ProfitMarginFetchType = {
  spot_prices: { date: string; amount: number }[];
  selling_prices: { date: string; amount: number }[];
};

export default function RegionalDashboard({ params }: { params: { id: string } }) {
  const { data: profitMarginFetch }: { data: ProfitMarginFetchType } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/profitMargin`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  function calculateProfitMargin(profitMarginFetch: ProfitMarginFetchType): number {
    if (!profitMarginFetch) return 0;
    const lastSpotPrice = profitMarginFetch.spot_prices.at(-1)?.amount;
    const lastSellingPrice = profitMarginFetch.selling_prices.at(-1)?.amount;
    if (lastSpotPrice === undefined || lastSellingPrice === undefined) {
      return 0;
    } else {
      return Math.round(((lastSellingPrice - lastSpotPrice) / lastSellingPrice) * 100);
    }
  }
  const currentSpotPrice =
    profitMarginFetch?.spot_prices?.at(-1)?.amount?.toLocaleString("en-AU", { style: "currency", currency: "AUD" }) ||
    "$0.00";

  return (
    <div className="grid grid-cols-2 grid-rows-[min-content_1fr_1fr_min-content] gap-3 grid-flow-col">
      <div>
        <div className="flex justify-between items-center mb-3">
          <PageHeading title={`Region - ${decodeURI(params.id)}`} />
          <div className="text-red-600 font-semibold text-xl">Power Outage</div>
        </div>
        <div className="flex justify-between gap-3">
          <InfoBox title={currentSpotPrice} description="Price of electricity per kW/h" />
          <ProfitMargin profitMargin={useMemo(() => calculateProfitMargin(profitMarginFetch), [profitMarginFetch])} />
          <InfoBox title="20%" description="Of green energy goal met" />
          <InfoBox title="1" description="Warnings" />
        </div>
      </div>

      <EnergyChart />
      <ProfitChart />
      <WarningTable />
    </div>
  );
}

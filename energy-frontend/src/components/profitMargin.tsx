"use client";

import { useEffect, useMemo, useState } from "react";
import InfoBox from "./infoBox";
import { fetcher } from "@/utils";
import useSWR from "swr";
import { POLLING_RATE } from "@/config";

export default function ProfitMargin() {
  const { data } = useSWR("http://localhost:3000/retailer/profitMargin", fetcher, { refreshInterval: POLLING_RATE });
  const [profitMargin, setProfitMargin] = useState(0);

  useEffect(() => {
    if (!data) return;

    const records: { date: string; spot_price?: number; selling_price?: number }[] = data.profit;
    const lastSpotPrice = records.filter((record) => record.spot_price).at(-1)?.spot_price;
    const lastSellPrice = records.filter((record) => record.selling_price).at(-1)?.selling_price;
    if (lastSpotPrice === undefined || lastSellPrice === undefined) {
      setProfitMargin(0);
    } else {
      setProfitMargin(Math.round(((lastSellPrice - lastSpotPrice) / lastSellPrice) * 100));
    }
  }, [data]);

  return (
    <InfoBox
      title={profitMargin?.toString() + "%"}
      description="Current Profit Margin"
      textColour={getTextColour(profitMargin)}
    />
  );
}

function getTextColour(profitMargin: number) {
  if (profitMargin >= 50) {
    return "text-[#B2FBA5]";
  } else if (profitMargin >= 0 && profitMargin < 50) {
    return "text-[#FFA500]";
  } else {
    return "text-[#FF6961]";
  }
}

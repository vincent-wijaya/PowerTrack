"use client";

import { useEffect, useMemo, useState } from "react";
import InfoBox from "./infoBox";
import { fetcher } from "@/utils";
import useSWR from "swr";
import { POLLING_RATE } from "@/config";

export default function ProfitMargin() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  const { data } = useSWR(`${url}/retailer/profitMargin`, fetcher, {
    refreshInterval: POLLING_RATE,
  });
  const [profitMargin, setProfitMargin] = useState(0);

  useEffect(() => {
    if (!data) return;
    const lastSpotPrice = data.spot_prices.at(-1)?.amount;
    const lastSellingPrice = data.selling_prices.at(-1)?.amount;
    if (lastSpotPrice === undefined || lastSellingPrice === undefined) {
      setProfitMargin(0);
    } else {
      setProfitMargin(Math.round(((lastSellingPrice - lastSpotPrice) / lastSellingPrice) * 100));
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

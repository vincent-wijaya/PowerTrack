"use client";

import { useEffect, useMemo, useState } from "react";
import InfoBox from "./infoBox";
import { fetcher } from "@/utils";
import useSWR from "swr";
import { POLLING_RATE } from "@/config";

export default function ProfitMargin(props: {profitMargin: number}) {


  return (
    <InfoBox
      title={props.profitMargin?.toString() + "%"}
      description="Current Profit Margin"
      textColour={getTextColour(props.profitMargin)}
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

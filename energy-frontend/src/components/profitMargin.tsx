"use client";

import { useEffect, useState } from "react";
import InfoBox from "./infoBox";

interface ProfitMarginProps {
  buyPrice?: number;
  sellPrice?: number;
}

export default function ProfitMargin(props: ProfitMarginProps) {
  const [profitMargin, setProfitMargin] = useState(0);
  const [textColour, setTextColour] = useState("text-black");
  useEffect(() => {
    const newPM =
      props.buyPrice === undefined || props.sellPrice === undefined
        ? 0
        : Math.round(((props.sellPrice - props.buyPrice) / props.sellPrice) * 100);
    console.log(newPM);
    setProfitMargin(newPM);

    if (newPM >= 50) {
      setTextColour("text-[#B2FBA5]");
    } else if (newPM >= 0 && newPM < 50) {
      setTextColour("text-[#FFA500]");
    } else {
      setTextColour("text-[#FF6961]");
    }
  }, [props.buyPrice, props.sellPrice]);
  return <InfoBox title={profitMargin + "%"} description="Current Profit Margin" textColour={textColour} />;
}

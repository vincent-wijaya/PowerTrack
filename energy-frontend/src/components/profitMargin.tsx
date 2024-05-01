import InfoBox from "./infoBox";

interface ProfitMarginProps {
  buyPrice?: number;
  sellPrice?: number;
}

export default function ProfitMargin(props: ProfitMarginProps) {
  let profitMargin =
    props.buyPrice === undefined || props.sellPrice === undefined
      ? 0
      : Math.round(((props.sellPrice - props.buyPrice) / props.sellPrice) * 100);
  return <InfoBox title={profitMargin + "%"} description="Current Profit Margin" />;
}

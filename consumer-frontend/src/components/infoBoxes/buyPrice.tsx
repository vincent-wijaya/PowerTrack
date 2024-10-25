'use client';

import { useEffect, useMemo, useState } from 'react';
import InfoBox from './infoBox';
import { fetcher } from '@/utils';
import useSWR from 'swr';
import { POLLING_RATE } from '@/config';

export default function BuyPrice() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  const { data } = useSWR(`${url}/consumer/buyingPrice`, fetcher, {
    refreshInterval: POLLING_RATE,
  });
  const [buyPrce, setBuyPrce] = useState(0);

  useEffect(() => {
    if (!data) return;
    setBuyPrce(data.amount);
  }, [data]);

  return (
    <InfoBox
      title={`$${buyPrce?.toFixed(2).toString()}`}
      description="Current Price per kWh"
    />
  );
}

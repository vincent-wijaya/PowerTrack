import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWR from 'swr';

export interface Price {
  date: string;
  amount: number;
}

export interface ProfitMarginData {
  start_date: string;
  end_date?: string;
  values: {
    selling_prices: Price[];
    spot_prices: Price[];
    profits: Price[];
  };
}

export const fetchProfitMargin = (
  startDate: string | Date
): ProfitMarginData => {
  const { data: profitMarginData } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/profitMargin?start_date=${startDate}`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  return profitMarginData;
};

import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWR from 'swr';
import { Price } from './getProfitMargin';

export interface SpendingData {
  start_date: string;
  end_date?: string;
  consumer_id?: string | number;
  spending: Price[];
}

export const fetchSpending = (
  startDate: string | Date,
  consumer_id?: string | number
): SpendingData => {
  const { data: spendingData } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/consumer/spending?start_date=${startDate}${consumer_id ? `&consumer_id=${consumer_id}` : ''}`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  return spendingData;
};

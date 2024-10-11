import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWR from 'swr';

export interface EnergySource {
  category: string;
  renewable: boolean;
  percentage: number;
  amount: number;
}

export interface EnergySources {
  start_date: string;
  end_date?: string;
  consumer_id?: string | number;
  suburb_id?: string | number;
  sources: EnergySource[];
}

export const fetchSources = (
  startDate: string | Date,
  id?: string | number,
  type?: string
): EnergySources => {
  const { data: energySourceData } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/sources?start_date=${startDate}${type ? `&${type}_id=${id}` : ''}`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  return energySourceData;
};

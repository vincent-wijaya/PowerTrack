import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWRImmutable from 'swr/immutable';

export interface RenewableEnergyGenerationAmount {
  date: string;
  amount: number;
}

export interface RenewableEnergyGenerationData {
  start_date: string;
  end_date?: string;
  suburb_id?: string | number;
  consumer_id?: string | number;
  energy: RenewableEnergyGenerationAmount[];
}

export const fetchRenewableEnergyGeneration = (
  startDate: string | Date,
  endDate: string | Date,
  id?: string | number,
  type?: string
): RenewableEnergyGenerationData => {
  const { data: renewableEnergyGenerationData } = useSWRImmutable(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/renewableGeneration?start_date=${startDate}&end_date=${endDate}${type ? `&${type}_id=${id}` : ''}`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  return renewableEnergyGenerationData;
};

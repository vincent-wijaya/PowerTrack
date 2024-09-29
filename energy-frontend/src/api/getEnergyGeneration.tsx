import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWRImmutable from 'swr/immutable';

export interface EnergyGenerationAmount {
  date: string;
  amount: number;
}

export interface EnergyGenerationData {
  start_date: string;
  end_date?: string;
  suburb_id?: string | number;
  consumer_id?: string | number;
  energy: EnergyGenerationAmount[];
}

export const fetchEnergyGeneration = (
  startDate: string | Date,
  endDate: string | Date,
  id?: string | number,
  type?: string
): EnergyGenerationData => {
  const { data: energyGenerationData } = useSWRImmutable(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/generation?start_date=${startDate}&end_date=${endDate}${type ? `&${type}_id=${id}` : ''}`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  return energyGenerationData;
};

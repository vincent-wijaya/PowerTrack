import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWRImmutable from 'swr/immutable';

export interface EnergyConsumptionAmount {
  date: string;
  amount: number;
}

export interface EnergyConsumptionData {
  start_date: string;
  end_date?: string;
  suburb_id?: string | number;
  consumer_id?: string | number;
  energy: EnergyConsumptionAmount[];
}

export const fetchEnergyConsumption = (
  startDate: string | Date,
  endDate: string | Date,
  id?: string | number,
  type?: string
): EnergyConsumptionData => {
  const { data: energyConsumptionData } = useSWRImmutable(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/consumption?start_date=${startDate}&end_date=${endDate}${type ? `&${type}_id=${id}` : ''}`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  return energyConsumptionData;
};

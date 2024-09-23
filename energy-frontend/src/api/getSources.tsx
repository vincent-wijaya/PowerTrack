import { POLLING_RATE } from "@/config";
import { fetcher } from "@/utils";
import useSWRImmutable from "swr/immutable";

export interface EnergySource {
    category: string;
    renewable: boolean;
    percentage: number;
    amount: number;
};

export interface EnergySources {
    start_date: string;
    end_date: string;
    consumer_id?: number | string;
    suburb_id?: number | string;
    sources: EnergySource[];
};

export const fetchSources = (id: string | number, type: string, startDate: string | Date, endDate: string | Date): EnergySources => {
    const { data: energySourceData } = useSWRImmutable(
        `${process.env.NEXT_PUBLIC_API_URL}/retailer/sources?${type ? `${type}_id=${id}&` : ''}start_date=${startDate}&end_date${endDate}`,
        fetcher,
        {
          refreshInterval: POLLING_RATE,
        }
      );

    return energySourceData;
}
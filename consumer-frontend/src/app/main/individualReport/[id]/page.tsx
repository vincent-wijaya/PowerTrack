'use client';
import EnergySourceBreakdown from '@/components/energySourceBreakdown';
import InfoBox from '@/components/infoBoxes/infoBox';
import PageHeading from '@/components/pageHeading';
import ReportsConsumptionChart from '@/components/charts/reportsConsumptionChart';
import { POLLING_RATE } from '@/config';
import { fetcher, getTemporalGranularity } from '@/utils';
import { DateTime } from 'luxon';
import { useState, useEffect, useMemo } from 'react';
import { exportToPDF } from '@/utils'; // Import the utility function
import useSWR from 'swr';
import GreenUsage from '@/components/infoBoxes/greenUsage';
import { formatCurrency } from '@/utils';
import { EnergySource } from '@/api/getSources';
import { DropdownOption } from '@/components/charts/dropDownFilter';
import ProfitChart from '@/components/charts/profitChart';
import { Price, ProfitMarginData } from '@/api/getProfitMargin';
import EnergyChart from '@/components/charts/energyChart';
import { EnergyGenerationAmount } from '@/api/getEnergyGeneration';
import { EnergyConsumptionAmount } from '@/api/getEnergyConsumption';
import ConsumerSpendChart from '@/components/charts/consumerSpendChart';

interface Report {
  id: number;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  for: {
    suburb_id: number;
    consumer_id: number | null;
  };
  energy: {
    consumption: EnergyConsumptionAmount[];
    generation: EnergyGenerationAmount[];
    green_energy: {
      green_usage_percent: number;
      green_goal_percent: number;
    };
    sources: EnergySource[];
  };
  selling_prices: Price[];
  spot_prices: Price[];
  profits: Price[];
}

interface SuburbData {
  id: string;
  latitude: string;
  longitude: string;
  name: string;
  postcode: number;
  state: string;
}

interface Consumer {
  suburb_id: number;
  suburb_name: string;
  suburb_post_code: string;
  id: number;
  address: string;
  high_priority: boolean;
}

interface ConsumerResponse {
  consumers: Consumer[];
}

export default function IndividualReport({
  params,
}: {
  params: { id: string };
}) {
  const mainurl = process.env.NEXT_PUBLIC_API_URL;
  const reportId = parseInt(params.id, 10);
  const [averageProfitkwh, setAverageProfitkwh] = useState(0);
  const [averageProfitMargin, setAverageProfitMargin] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [consumptionData, setConsumptionData] = useState<
    EnergyConsumptionAmount[]
  >([]);
  const [generationData, setGenerationData] = useState<
    EnergyGenerationAmount[]
  >([]);
  const [energyChartTitle, setEnergyChartTitle] = useState('');
  const [isExporting, setIsExporting] = useState(false); // New state for exporting
  const [energySources, setEnergySources] = useState<EnergySource[]>([]);

  const [granularity, setGranularity] = useState<string>();

  const [title, setTitle] = useState('');

  // Fetch the report here
  const { data, error } = useSWR<Report>(
    `${mainurl}/retailer/reports/${reportId}`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  const suburbId = data?.for.suburb_id;
  const consumerId = data?.for.consumer_id;

  const { data: suburbData, error: suburbError } = useSWR<SuburbData>(
    suburbId ? `${mainurl}/retailer/suburbs/${suburbId}` : null,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  const consumerID = data?.for.consumer_id;
  const { data: consumerData, error: consumerError } = useSWR<ConsumerResponse>(
    consumerId
      ? `${mainurl}/retailer/consumers?consumer_id=${consumerID}`
      : null,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  // Set the data to display for consumer case here
  useEffect(() => {
    if (data?.for.consumer_id && consumerData) {
      const consumer = consumerData.consumers[0];

      setTitle(`${consumer.address}, ${consumer.suburb_post_code}`);

      const spendingPrice = data.energy.consumption?.map((item) => ({
        date: item.date,
        amount: item.amount * Number(data.selling_prices.at(-1)?.amount),
      }));

      setConsumptionData(data.energy.consumption);

      setEnergyChartTitle('Energy Consumption');

      setEnergySources(data.energy.sources);
    }
  }, [data, consumerData]);

  // Handle PDF Export
  const handleExport = async () => {
    setIsExporting(true); // Set exporting state to true
    await exportToPDF('contentToExport'); // Call export function
    setIsExporting(false); // Set exporting state back to false after export
  };

  if (error) return <div>Error loading report.</div>;
  if (!data) return <div className="text-white">Loading...</div>;
  if (data === null) return <div>No report found.</div>;

  return (
    <div
      className="bg-bgmain"
      id="contentToExport"
    >
      <div className="flex justify-between">
        <PageHeading title="REPORT" />
        <button
          onClick={handleExport}
          className={`p-4 bg-purple text-white text-center rounded-lg ${
            isExporting ? 'hidden' : ''
          }`}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting...' : 'Export to PDF'}
        </button>
      </div>
      <div className="text-white pb-2">
        {DateTime.fromISO(data.start_date).toFormat('D')} -{' '}
        {DateTime.fromISO(data.end_date).toFormat('D')}
        <br></br>
        {title}
      </div>
      <div className="grid grid-flow-col grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <EnergySourceBreakdown
            chartTitle={`${suburbData?.name}'s Energy Generation Source Breakdown`}
            energySources={energySources}
            showTimeRangeDropdown={false}
          />
        </div>
        <div className="flex flex-col gap-3">
          <EnergyChart
            chartTitle={energyChartTitle}
            energyGenerationData={generationData}
            energyConsumptionData={consumptionData}
            granularity={granularity ?? 'year'}
          />
          <ConsumerSpendChart
            chartTitle="Spending"
            consumptionData={consumptionData}
            buyingPrice={Number(data.selling_prices.at(-1)?.amount)}
            granularity={granularity ?? 'year'}
          />
        </div>
      </div>
    </div>
  );
}

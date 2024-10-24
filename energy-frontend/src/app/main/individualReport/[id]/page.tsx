'use client';
import EnergySourceBreakdown from '@/components/energySourceBreakdown';
import InfoBox from '@/components/infoBoxes/infoBox';
import PageHeading from '@/components/pageHeading';
import { POLLING_RATE } from '@/config';
import { fetcher, getTemporalGranularity } from '@/utils';
import { DateTime } from 'luxon';
import { useState, useEffect } from 'react';
import { exportToPDF } from '@/utils'; // Import the utility function
import useSWR from 'swr';
import GreenUsage from '@/components/infoBoxes/greenUsage';
import { formatCurrency } from '@/utils';
import { EnergySource } from '@/api/getSources';
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
  spending: Price[];
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
  suburb_id: number | string;
  suburb_name: string;
  suburb_post_code: number | string;
  id: number | string;
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
  const mainurl = process.env.NEXT_PUBLIC_API_URL; // API base URL
  const reportId = parseInt(params.id, 10); // Parse the report ID from the route parameter
  const [averageProfitkwh, setAverageProfitkwh] = useState(0); // State for average profit per kWh
  const [averageProfitMargin, setAverageProfitMargin] = useState(0); // State for average profit margin
  const [totalProfit, setTotalProfit] = useState(0); // State for total profit
  const [totalSpending, setTotalSpending] = useState(0); // State for total spending
  const [totalRevenue, setTotalRevenue] = useState(0); // State for total revenue
  const [consumptionData, setConsumptionData] = useState<EnergyConsumptionAmount[]>([]); // State for energy consumption data
  const [generationData, setGenerationData] = useState<EnergyGenerationAmount[]>([]); // State for energy generation data
  const [energyChartTitle, setEnergyChartTitle] = useState(''); // State for the energy chart title
  const [profitChartData, setProfitChartData] = useState<ProfitMarginData>(); // State for profit chart data
  const [spendingData, setSpendingData] = useState<Price[]>([]); // State for consumer spending data
  const [isExporting, setIsExporting] = useState(false); // State to track exporting status
  const [energySources, setEnergySources] = useState<EnergySource[]>([]); // State for energy sources
  const [granularity, setGranularity] = useState<string>(); // State for data granularity (e.g., daily, monthly)
  const [title, setTitle] = useState(''); // State for the page title
  const [highPriority, setHighPriority] = useState(false); // State to indicate if the consumer is high priority

  // Fetch the report data
  const { data, error } = useSWR<Report>(
    `${mainurl}/retailer/reports/${reportId}`,
    fetcher,
    {
      refreshInterval: POLLING_RATE, // Polling interval for refreshing data
    }
  );

  // Extract suburb and consumer IDs from the report data
  const suburbId = data?.for.suburb_id;
  const consumerId = data?.for.consumer_id;

  // Fetch suburb data based on suburbId
  const { data: suburbData, error: suburbError } = useSWR<SuburbData>(
    suburbId !== undefined && suburbId !== null
      ? `${mainurl}/retailer/suburbs/${suburbId}`
      : null,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  // Fetch consumer data based on consumerId
  const { data: consumerData, error: consumerError } = useSWR<ConsumerResponse>(
    consumerId !== undefined && consumerId !== null
      ? `${mainurl}/retailer/consumers?consumer_id=${consumerId}`
      : null,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  // Set data for the suburb case when report is available
  useEffect(() => {
    if (!data) return; // Exit if no data is available

    if (data?.for.suburb_id !== null && suburbData) {
      setTitle(`${suburbData.name}, ${suburbData.postcode}, ${suburbData.state}`); // Set title for suburb
      setConsumptionData(data.energy.consumption); // Set energy consumption data
      setGenerationData(data.energy.generation); // Set energy generation data
      setEnergyChartTitle('Energy Consumption/Generation'); // Set chart title
      setEnergySources(data.energy.sources); // Set energy sources

      // Calculate total revenue from energy generation and selling prices
      const totalRevenue = data.energy.generation?.reduce(
        (acc: number, item: { date: string; amount: number }) => {
          return acc + Number(data.selling_prices.at(-1)) * item.amount;
        },
        0
      );
      setTotalRevenue(totalRevenue); // Set total revenue
    }

    // Set data granularity based on the report date range
    setGranularity(getTemporalGranularity(data.start_date, data.end_date));

    // Prepare profit chart data
    setProfitChartData({
      start_date: data.start_date,
      values: {
        selling_prices: data.selling_prices,
        spot_prices: data.spot_prices,
        profits: data.profits,
      },
    });
  }, [data, suburbData]);

  // Set data for the consumer case when report is available
  useEffect(() => {
    if (!data) return; // Exit if no data is available

    if (data?.for.consumer_id !== null && consumerData) {
      const consumer = consumerData.consumers[0]; // Get the consumer details
      setTitle(`${consumer.address}, ${consumer.suburb_post_code}`); // Set title for the consumer
      setHighPriority(true); // Mark consumer as high priority if applicable
      setSpendingData(data.spending); // Set consumer spending data

      // Calculate total spending
      const totalSpending =
        data.spending?.reduce((total, s) => total + s.amount, 0) ?? 0;
      setTotalSpending(totalSpending); // Set total spending

      setConsumptionData(data.energy.consumption); // Set energy consumption data
      setEnergyChartTitle('Energy Consumption'); // Set chart title
      setEnergySources(data.energy.sources); // Set energy sources
    }
  }, [data, consumerData]);

  // Handle PDF export of the report
  const handleExport = async () => {
    setIsExporting(true); // Indicate export in progress
    await exportToPDF('contentToExport'); // Trigger PDF export
    setIsExporting(false); // Reset export state once done
  };

  // Handle error states and loading states
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
      {consumerData?.consumers?.[0]?.high_priority && (
        <div className="text-red text-left font-semibold">HIGH PRIORITY</div>
      )}
      <div className="text-white pb-2">
        {DateTime.fromISO(data.start_date).toFormat('D')} -{' '}
        {DateTime.fromISO(data.end_date).toFormat('D')}
        <br></br>
        {title}
      </div>
      <div className="grid grid-flow-col grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          {data?.for.consumer_id === null && suburbData ? ( // For suburb
            <div className="flex justify-between gap-3 h-[128px]">
              <InfoBox
                title={formatCurrency(averageProfitkwh)}
                description="Average Profit per kWh sold when bought"
              />
              <InfoBox
                title={formatCurrency(averageProfitMargin)}
                description="Average Profit Margin"
              />
              <GreenUsage />
              <InfoBox
                title={formatCurrency(totalProfit)}
                description="Profitted"
              />
              <InfoBox
                title={formatCurrency(totalRevenue)}
                description="Revenue made"
              />
            </div>
          ) : (
            <div className="flex justify-between gap-3 h-[128px]">
              <InfoBox
                title={formatCurrency(totalSpending)}
                description="Spent"
              />
              <GreenUsage />
            </div>
          )}

          {/*<EnergySourceBreakdown energySources={data.sources} />*/}
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
          {data?.for.consumer_id === null && suburbData ? ( // For suburb
            <ProfitChart
              chartTitle="Profit Analysis"
              profitMarginData={profitChartData}
              granularity={granularity ?? 'year'}
            />
          ) : (
            // For consumer
            <ConsumerSpendChart
              chartTitle="Spending"
              spendingData={spendingData}
              granularity={granularity ?? 'year'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

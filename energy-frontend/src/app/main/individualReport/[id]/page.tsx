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
  const mainurl = process.env.NEXT_PUBLIC_API_URL;
  const reportId = parseInt(params.id, 10);
  const [averageProfitkwh, setAverageProfitkwh] = useState(0);
  const [averageProfitMargin, setAverageProfitMargin] = useState(0);
  const [greenEnergyUsage, setgreenEnergyUsage] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalSpending, setTotalSpending] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [consumptionData, setConsumptionData] = useState<
    EnergyConsumptionAmount[]
  >([]);
  const [generationData, setGenerationData] = useState<
    EnergyGenerationAmount[]
  >([]);
  const [energyChartTitle, setEnergyChartTitle] = useState('');
  const [profitChartData, setProfitChartData] = useState<ProfitMarginData>();
  const [spendingData, setSpendingData] = useState<Price[]>([]);
  const [profitChartTitle, setprofitChartTitle] = useState('');
  const [isExporting, setIsExporting] = useState(false); // New state for exporting
  const [energySources, setEnergySources] = useState<EnergySource[]>([]);

  const [granularity, setGranularity] = useState<string>();

  const [title, setTitle] = useState('');

  const [highPriority, setHighPriority] = useState(false);

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
    suburbId !== undefined && suburbId !== null
      ? `${mainurl}/retailer/suburbs/${suburbId}`
      : null,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  const { data: consumerData, error: consumerError } = useSWR<ConsumerResponse>(
    consumerId !== undefined && consumerId !== null
      ? `${mainurl}/retailer/consumers?consumer_id=${consumerId}`
      : null,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  // Set the data to display for suburb case here
  useEffect(() => {
    if (!data) return;

    if (data?.for.suburb_id !== null && suburbData) {
      // Title
      setTitle(
        `${suburbData.name}, ${suburbData.postcode}, ${suburbData.state}`
      );

      // // Green energy usage
      // const totalGreenEnergy = data.sources.reduce((acc, source) => {
      //   return source.renewable ? acc + source.amount : acc;
      // }, 0);

      // const totalEnergy = data.sources.reduce(
      //   (acc, source) => acc + source.amount,
      //   0
      // );

      // setgreenEnergyUsage((totalGreenEnergy / totalEnergy) * 100);

      setConsumptionData(data.energy.consumption);
      setGenerationData(data.energy.generation);

      setEnergyChartTitle('Energy Consumption/Generation');
      setEnergySources(data.energy.sources);

      // Total Revenue
      const totalRevenue = data.energy.generation?.reduce(
        (acc: number, item: { date: string; amount: number }) => {
          return acc + Number(data.selling_prices.at(-1)) * item.amount;
        },
        0
      );

      setTotalRevenue(totalRevenue);
    }

    setGranularity(getTemporalGranularity(data.start_date, data.end_date));

    setProfitChartData({
      start_date: data.start_date,
      values: {
        selling_prices: data.selling_prices,
        spot_prices: data.spot_prices,
        profits: data.profits,
      },
    });
    // Total Profit
  }, [data, suburbData]);

  // Set the data to display for consumer case here
  useEffect(() => {
    if (!data) return;
    console.log(data);

    if (data?.for.consumer_id !== null && consumerData) {
      const consumer = consumerData.consumers[0];
      const highPriority = true; // Directly use the boolean value

      // Update the title with "High Priority" if applicable
      setTitle(`${consumer.address}, ${consumer.suburb_post_code}`);

      setHighPriority(true);

      setSpendingData(data.spending);

      const totalSpending =
        data.spending?.reduce((total, s) => {
          return total + s.amount;
        }, 0) ?? 0;
      setTotalSpending(totalSpending);

      setConsumptionData(data.energy.consumption);
      // setSpendingPriceData(spendingPrice);

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

          {/*         <ProfitChart />
          <EnergyChart className="" />*/}
        </div>
        {/* <div className="p-4 bg-itembg border border-stroke rounded-lg">
          <EnergyChart />
        </div>
        <div className="p-4 bg-itembg border border-stroke rounded-lg">
          <ProfitChart />
        </div> */}
      </div>

      {/* <div className="h-screen px-10 grid grid-cols-2 gap-8 py-10">
        <div className="gap-8 py-10">
          <div className="h-1/6 gap-2 grid grid-cols-3">
            <InfoBox title="48%" description="of green energy goal met" />
            <InfoBox title="3" description="Warnings" />
            <InfoBox title="3" description="Suggestions" />
          </div>
          <div className="h-1/3 mt-8 p-4 bg-itembg border border-stroke rounded-lg">
            <Map />
          </div>
          <div className="h-1/3 gap-2 py-10">
            <WarningTable />
          </div>
        </div>
        <div className="gap-8 py-10">
          <div className="ml-8 p-4 bg-itembg border border-stroke rounded-lg">
            <EnergyChart />
          </div>
          <div className="ml-8 mt-4 p-4 bg-itembg border border-stroke rounded-lg">
            <ProfitChart />
          </div>
        </div>
      </div> */}
    </div>
  );
}

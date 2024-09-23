'use client';
import fetchEnergyConsumption from '@/api/energyConsumption';
import fetchReport from '@/api/getReport';
import Headings from '@/app/main/template';
import EnergyChart from '@/components/charts/energyChart';
import EnergySourceBreakdown from '@/components/energySourceBreakdown';
import InfoBox from '@/components/infoBoxes/infoBox';
import PageHeading from '@/components/pageHeading';
import ProfitMargin from '@/components/infoBoxes/profitMargin';
import ProfitChart from '@/components/charts/profitChart';
import WarningTable from '@/components/tables/warningTable';
import ReportsConsumptionChart from '@/components/charts/reportsConsumptionChart';
import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import { DateTime } from 'luxon';
import { useState, useEffect, useMemo } from 'react';
import { exportToPDF } from '@/utils'; // Import the utility function
import useSWR from 'swr';
import GreenUsage from '@/components/infoBoxes/greenUsage';
import { formatCurrency } from '@/utils';
import { EnergySource } from '@/api/getSources';
import { DropdownOption } from '@/components/charts/dropDownFilter';

interface Report {
  id: number;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  for: {
    suburb_id: number;
    consumer_id: number | null;
  };
  energy: Array<{
    start_date: string; // ISO date string
    end_date: string; // ISO date string
    consumption: number;
    generation: number;
  }>;
  selling_price: Array<{
    date: string; // ISO date string
    amount: number;
  }>;
  spot_price: Array<{
    date: string; // ISO date string
    amount: number;
  }>;
  sources: EnergySource[];
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
  const [greenEnergyUsage, setgreenEnergyUsage] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const spendage = '$9000';
  const [consumptionData, setConsumptionData] = useState<number[]>([]);
  const [generationData, setGenerationData] = useState<number[]>([]);
  const [profitData, setProfitData] = useState<number[]>([]);
  const [energychartData, setEnergyChartData] = useState([{}]);
  const [energyDateArray, setEnergyDateArray] = useState<string[]>([]);
  const [energyChartTitle, setEnergyChartTitle] = useState('');
  const [profitArray, setProfitArray] = useState<number[]>([]);
  const [spotPriceData, setSpotPriceData] = useState<number[]>([]);
  const [sellingPriceData, setSellingPriceData] = useState<number[]>([]);
  const [spendingPriceData, setSpendingPriceData] = useState<number[]>([]);
  const [profitDateArray, setProfitDateArray] = useState<string[]>([]);
  const [profitChartData, setProfitChartData] = useState([{}]);
  const [profitChartTitle, setprofitChartTitle] = useState('');
  const [isExporting, setIsExporting] = useState(false); // New state for exporting
  const [energySources, setEnergySources] = useState<EnergySource[]>([]);

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

  // Set the data to display for suburb case here
  useEffect(() => {
    if (data?.for.consumer_id === null && suburbData) {
      // Title

      setTitle(
        `${suburbData.name}, ${suburbData.postcode}, ${suburbData.state}`
      );

      // Average Profit Kwh
      const totalProfitPerKwh = data.selling_price.reduce(
        (acc, item, index) => {
          const spotPrice = data.spot_price[index]?.amount || 0;
          return acc + (item.amount - spotPrice);
        },
        0
      );

      setAverageProfitkwh(totalProfitPerKwh / data.selling_price.length);

      // Average Profit Margin
      const totalProfitMargin = data.selling_price.reduce(
        (acc, item, index) => {
          const spotPrice = data.spot_price[index]?.amount || 0;
          const profitMargin = ((item.amount - spotPrice) / spotPrice) * 100;
          return acc + profitMargin;
        },
        0
      );

      setAverageProfitMargin(totalProfitMargin / data.selling_price.length);

      // // Green energy usage
      // const totalGreenEnergy = data.sources.reduce((acc, source) => {
      //   return source.renewable ? acc + source.amount : acc;
      // }, 0);

      // const totalEnergy = data.sources.reduce(
      //   (acc, source) => acc + source.amount,
      //   0
      // );

      // setgreenEnergyUsage((totalGreenEnergy / totalEnergy) * 100);

      // Total Profit
      const totalProfit = data.energy.reduce((acc, item, index) => {
        const sellingPrice = data.selling_price[index]?.amount || 0;
        const spotPrice = data.spot_price[index]?.amount || 0;
        const profitPerKwh = sellingPrice - spotPrice;
        return acc + profitPerKwh * item.generation;
      }, 0);

      setTotalProfit(totalProfit);

      const generationVal = data.energy.map((item: any) => item.generation);

      const consumptionVal = data.energy.map((item: any) => item.consumption);

      setConsumptionData(consumptionVal);
      setGenerationData(generationVal);

      const energyDateVal = data.energy.map((item: any) => item.start_date);

      const tempChartData = [
        {
          label: 'Energy Consumption',
          data: consumptionData,
          borderColor: 'red',
          backgroundColor: 'white',
        },
        {
          label: 'Energy Generation',
          data: generationData,
          borderColor: 'blue',
          backgroundColor: 'white',
        },
      ];

      const spotPrices = data.spot_price.map((price) => price.amount);
      const sellingPrices = data.selling_price.map((price) => price.amount);
      const dates = data.selling_price.map((price) => price.date);

      // Calculate the profit data
      const profitArrayVals = sellingPrices.map((sellingPrice, index) => {
        const spotPrice = spotPrices[index];
        return sellingPrice - (spotPrice || 0); // Subtract spot price if available, otherwise use 0
      });

      setProfitArray(profitArrayVals);
      setSpotPriceData(spotPrices);
      setSellingPriceData(sellingPrices);
      setProfitDateArray(dates);

      const tempProfitChartData = [
        {
          label: 'Selling Price',
          data: sellingPriceData,
          borderColor: 'red',
          backgroundColor: 'white',
        },
        {
          label: 'Spot Price',
          data: spotPriceData,
          borderColor: 'blue',
          backgroundColor: 'white',
        },
        {
          label: 'Profit',
          data: spotPriceData,
          borderColor: 'green',
          backgroundColor: 'white',
        },
      ];

      setProfitChartData(tempProfitChartData);

      setEnergyDateArray(energyDateVal);

      setEnergyChartData(tempChartData);
      setEnergyChartTitle('Energy Consumption/Generation');
      setprofitChartTitle('Profit Analysis');
      setEnergySources(data.sources)

      // Total Revenue
      const totalRevenue = data.energy.reduce((acc, item, index) => {
        const sellingPrice = data.selling_price[index]?.amount || 0;
        return acc + sellingPrice * item.generation;
      }, 0);

      setTotalRevenue(totalRevenue);
    }

    // Total Profit
  }, [data, suburbData]);

  // Set the data to display for consumer case here
  useEffect(() => {
    if (data?.for.consumer_id && consumerData) {
      const consumer = consumerData.consumers[0];
      const highPriority = true; // Directly use the boolean value

      // Update the title with "High Priority" if applicable
      setTitle(`${consumer.address}, ${consumer.suburb_post_code}`);

      setHighPriority(true);

      const consumptionVal = data.energy.map((item: any) => item.consumption);
      const spendingPrice = data.energy.map(
        (item: any) => item.consumption * 0.31
      );

      setConsumptionData(consumptionVal);
      setSpendingPriceData(spendingPrice);
      setprofitChartTitle('Consumer Spending');

      const energyDateVal = data.energy.map((item: any) => item.start_date);

      const tempChartData = [
        {
          label: 'Energy Consumption',
          data: consumptionData,
          borderColor: 'red',
          backgroundColor: 'white',
        },
      ];
      const tempSpendingChartData = [
        {
          label: 'Total Spent',
          data: spendingPriceData,
          borderColor: 'red',
          backgroundColor: 'white',
        },
      ];

      setProfitChartData(tempSpendingChartData);

      setEnergyDateArray(energyDateVal);

      setEnergyChartData(tempChartData);

      setEnergyChartTitle('Energy Consumption');

      setEnergySources(data.sources);
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
      <PageHeading title="REPORT" />

      {highPriority && <div className="text-[#FFA500]">High Priority</div>}

      <div className="text-white py-2">
        {DateTime.fromISO(data.start_date).toFormat('D')} -{' '}
        {DateTime.fromISO(data.end_date).toFormat('D')}
        <br></br>
        {title}
      </div>
      <div className="grid grid-flow-col grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
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
          {/*<EnergySourceBreakdown energySources={data.sources} />*/}
          <EnergySourceBreakdown
            energySources={energySources}
            showTimeRangeDropdown={false}
          />
          <button
            onClick={handleExport}
            className={`p-4 w-full h-1/4 bg-purple text-white text-center rounded-lg mt-4 ${
              isExporting ? 'hidden' : ''
            }`}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export to PDF'}
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <ReportsConsumptionChart
            chartTitle={energyChartTitle}
            dataArray={energychartData}
            xAxisData={energyDateArray}
          />

          <ReportsConsumptionChart
            chartTitle={profitChartTitle}
            dataArray={profitChartData}
            xAxisData={profitDateArray}
          />

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

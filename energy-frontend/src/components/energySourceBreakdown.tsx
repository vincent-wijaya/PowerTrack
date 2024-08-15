import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import useSWR from 'swr';
import Dropdown from './dropDownFilter';

import {
  ArcElement,
  Chart as ChartJS,
  DoughnutController
} from 'chart.js';

ChartJS.register(DoughnutController, ArcElement);

type EnergySources = {
  category: string;
  renewable: boolean;
  percentage: number;
  count: number;
}[];

export default function EnergySourceBreakdown(props: {
  energySources: EnergySources;
  className?: string;
}) {
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<string>('last_year');

  const url = process.env.NEXT_PUBLIC_API_URL;
  const { data: energySourceData } = useSWR(
    `${url}/retailer/sources`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  const colours = [
    '#9747FF',
    '#FCA997',
    '#B91293',
    '#C3E1FF',
    '#FB4E22',
    '#F3A8E2',
    '#FFD7A3',
  ];

  return (
    <div
      className={`flex flex-col w-full h-full p-4 bg-itembg border border-stroke relative rounded-lg ${props.className ? props.className : ''}`}
    >
      <Dropdown
        onChange={setSelectedTimeRange}
        chartTitle={'Energy Sources'}
      />
      <div className="h-full">
        <Doughnut
          className="w-full"
          data={{
            labels: props.energySources.map((source) => source.category),
            datasets: [
              {
                label: 'Percentage',
                data: props.energySources.map(
                  (source) => +(source.percentage * 100).toFixed(2)
                ),
                backgroundColor: colours,
                borderWidth: 0,
                hoverOffset: 4,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: { usePointStyle: true, pointStyle: 'circle' },
              },
              datalabels: {
                display: true,
                color: 'white',
                font: {
                  weight: 'bold',
                },
                formatter: (value, context) => {
                  return `${props.energySources[context.dataIndex].count}\n(${value}%)`;
                },
              },
            },
          }}
          plugins={[ChartDataLabels as any]}
        />
      </div>
    </div>
  );
}

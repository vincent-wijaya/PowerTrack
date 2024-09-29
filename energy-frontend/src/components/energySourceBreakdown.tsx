import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Doughnut } from 'react-chartjs-2';
import Dropdown, { DropdownOption } from './charts/dropDownFilter';
import {
  ArcElement,
  Chart as ChartJS,
  DoughnutController,
  Legend,
} from 'chart.js';
import { EnergySource } from '@/api/getSources';

ChartJS.register(DoughnutController, ArcElement, Legend);

interface EnergySourceBreakdownProps {
  chartTitle: string;
  energySources: EnergySource[];
  showTimeRangeDropdown?: boolean;
  onTimeRangeChange?: (value: DropdownOption) => void;
  className?: string;
}

export default function EnergySourceBreakdown(
  props: EnergySourceBreakdownProps
) {
  const colours = [
    '#9747FF',
    '#FCA997',
    '#B91293',
    '#C3E1FF',
    '#FB4E22',
    '#F3A8E2',
    '#FFD7A3',
  ];

  const emptyChartData = {
    labels: ['No Data'],
    datasets: [
      {
        data: [1],
        backgroundColor: ['#4B5563'], // A gray color for the empty chart
        borderWidth: 0,
      },
    ],
  };

  return (
    <div
      className={`flex flex-col w-full h-[600px]" p-4 bg-itembg border border-stroke relative rounded-lg ${props.className ? props.className : ''}`}
    >
      {props.showTimeRangeDropdown && props.onTimeRangeChange ? (
        <Dropdown
          onChange={props.onTimeRangeChange}
          chartTitle={props.chartTitle}
        />
      ) : (
        <div className="flex w-full py-4 px-2 justify-between">
          <p className=" text-white font-semibold">{'Energy Sources'}</p>
        </div>
      )}
      {props.energySources?.length === 0 && (
        <div className="flex items-center justify-center">
          <span className="text-white font-inter font-semibold text-xl">
            No data for this period
          </span>
        </div>
      )}
      <div className="h-full">
        <Doughnut
          className="w-full"
          data={
            props.energySources && props.energySources.length > 0
              ? {
                  labels: props.energySources?.map(
                    (source: EnergySource) => source.category
                  ),
                  datasets: [
                    {
                      label: 'Percentage',
                      data: props.energySources.map(
                        (source: EnergySource) =>
                          +(source.percentage * 100).toFixed(2)
                      ),
                      backgroundColor: colours,
                      borderWidth: 0,
                      hoverOffset: 4,
                    },
                  ],
                }
              : emptyChartData
          }
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: props.energySources && props.energySources.length > 0,
                position: 'right',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  color: 'white',
                },
              },
              datalabels: {
                display: props.energySources && props.energySources.length > 0,
                color: 'white',
                font: {
                  weight: 'bold',
                },
                formatter: (value, context) => {
                  if (props.energySources && props.energySources.length > 0) {
                    const source = props.energySources[context.dataIndex];
                    const percentage = (source.percentage * 100).toFixed(2);
                    return `${percentage} kWh\n(${value}%)`;
                  }
                  return '';
                },
              },
              tooltip: {
                enabled: props.energySources && props.energySources.length > 0,
                callbacks: {
                  label: function (context: any) {
                    const source = props.energySources[context.dataIndex];
                    const percentage = (source.percentage * 100).toFixed(2);
                    const amount = Math.round(source.amount);
                    return [
                      `Amount: ${amount.toLocaleString()} kWh`,
                      `Percentage: ${percentage}%`,
                      `Renewable: ${source.renewable ? 'Yes' : 'No'}`,
                    ];
                  },
                },
              },
            },
            cutout: '50%',
          }}
          plugins={[ChartDataLabels as any]}
        />
      </div>
    </div>
  );
}

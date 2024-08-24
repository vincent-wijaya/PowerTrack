'use client';
import { useRouter } from 'next/navigation'; // Import useRouter
import React, { useState } from 'react';
import Calendar from 'react-calendar'; // Make sure to install react-calendar
import './calendar.css'; // Import your calendar styles
import Link from 'next/link';
import { fetcher } from '@/utils';
import useSWR from 'swr';
import { POLLING_RATE } from '@/config';
import { useEffect } from 'react';

const ReportForm = (props: { id: string; type: string }) => {
  const router = useRouter(); // Initialize useRouter

  const [consumerData, setConsumerData] = useState({});
  const [suburbData, setSuburbData] = useState({});

  const mainurl = process.env.NEXT_PUBLIC_API_URL;
  const url: string = (() => {
    switch (props.type) {
      case 'consumer':
        return `${mainurl}/retailer/consumers?consumer_id=${props.id}`; // Fetch data for a specific consumer
      case 'suburb':
        return `${mainurl}/retailer/suburbs/${props.id}`; // Fetch data for a specific suburb
      default:
        return 'null';
    }
  })();

  const { data, error } = useSWR(url, fetcher, {
    refreshInterval: POLLING_RATE,
  });

  useEffect(() => {
    if (!data) return;
    if (props.type == 'consumer') {
      setConsumerData(data.consumers[0]);
    } else if (props.type == 'suburb') {
      setSuburbData(data);
    }
  }, [data]);

  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(),
    new Date(),
  ]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDateChange = (dates: [Date, Date]) => {
    setDateRange(dates);
  };

  const handleSubmit = async () => {
    const start_date = dateRange[0].toISOString();
    const end_date = dateRange[1].toISOString();

    const forObj = {
      suburb_id: props.type === 'suburb' ? props.id : undefined,
      consumer_id: props.type === 'consumer' ? props.id : undefined,
    };

    try {
      const response = await fetch(`${mainurl}/retailer/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_date,
          end_date,
          for: forObj,
        }),
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        console.error('Error creating report:', errorMessage);
      } else {
        const reportData = await response.json();
        router.push(`/main/individualReport/${reportData.id.toString()}`);
        console.log('Report created successfully:', reportData);
      }
    } catch (error) {
      console.error('Failed to create report:', error);
    }
  };

  console.log(data);

  const handleCancel = () => {
    // Handle cancel logic here
    setSearchTerm('');
    setDateRange([new Date(), new Date()]);
  };

  const formatDateRange = () => {
    const [start, end] = dateRange;
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="w-full max-w-3xl bg-calendarbg p-6 border border-gray-300 rounded shadow-md">
        <div className="grid grid-cols-4 gap-4">
          {/* Search Column */}
          <div className="flex flex-col justify-between bg-itembg p-4 rounded">
            <h2 className="text-white bg-mainbg text-lg mb-2">Specified For</h2>
            {/* <div className="w-full text-white border-gray-300 rounded-md shadow-sm px-2 py-1">
              {props.id}
            </div> */}
            <div className="w-full text-white border-gray-300 rounded-md shadow-sm px-2 py-1">
              {props.type === 'consumer'
                ? `${consumerData.address} ${consumerData.suburb_post_code} ${consumerData.suburb_name}`
                : `${suburbData.name} ${suburbData.postcode} ${suburbData.state}`}
            </div>
            <div></div>
          </div>

          {/* Calendar Column */}
          <div className="col-span-3 flex flex-col">
            <div className="bg-itembg p-4 rounded">
              <h2 className="text-white text-lg mb-2 bg-mainbg ">
                Time Period
              </h2>
              <Calendar
                selectRange
                value={dateRange}
                onChange={handleDateChange}
                className="mb-4"
              />
            </div>
            <div className="flex justify-between mb-4 mt-4">
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 bg-green-500 text-white rounded"
              >
                Submit
              </button>
              <Link href={'/main/mainDashboard'}>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-purple text-white rounded"
                >
                  Cancel
                </button>
              </Link>
            </div>
            <div className="text-white mt-4">{formatDateRange()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportForm;

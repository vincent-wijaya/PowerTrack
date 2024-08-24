'use client';
import React, { useState } from 'react';
import Calendar from 'react-calendar'; // Make sure to install react-calendar
import './calendar.css'; // Import your calendar styles
import Link from 'next/link';
import { fetcher } from '@/utils';
import useSWR from 'swr';
import { POLLING_RATE } from '@/config';

const ReportForm = (props: { id: string; type: string }) => {
  const mainurl = process.env.NEXT_PUBLIC_API_URL;
  const url: string = (() => {
    switch (props.type) {
      case 'consumer':
        return `${mainurl}/retailer/consumer/${props.id}/data`; // Fetch data for a specific consumer
      case 'suburb':
        return `${mainurl}/retailer/suburb/${props.id}/data`; // Fetch data for a specific suburb
      default:
        return 'null';
    }
  })();

  const { data, error } = useSWR(url, fetcher, {
    refreshInterval: POLLING_RATE,
  });

  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(),
    new Date(),
  ]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDateChange = (dates: [Date, Date]) => {
    setDateRange(dates);
  };

  const handleSubmit = () => {
    // Handle submit logic here
    console.log('Submitted:', { searchTerm, dateRange });
  };

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
            <div className="w-full text-white border-gray-300 rounded-md shadow-sm px-2 py-1">
              {props.id}
            </div>
            {/* <div className="w-full text-white border-gray-300 rounded-md shadow-sm px-2 py-1">
              {props.type === 'consumer'
                ? `${data.address} ${data.suburb_post_code} ${data.suburb_name}`
                : `${data.name} ${data.postcode} ${data.state}`}
            </div>  commented out until i can link api*/}
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

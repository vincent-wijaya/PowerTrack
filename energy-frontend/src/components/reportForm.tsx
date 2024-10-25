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

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

type ConsumerData = {
  address: string;
  suburb_post_code: number;
  suburb_name: string;
};

type SuburbData = {
  name: string;
  postcode: number;
  state: string;
};

const ReportForm = (props: { id: string; type: string }) => {
  const router = useRouter(); // Initialize useRouter

  const [consumerData, setConsumerData] = useState<ConsumerData>();
  const [suburbData, setSuburbData] = useState<SuburbData>();
  const [errorMessage, setErrorMessage] = useState(''); // State to track error message

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

  const handleDateChange = (dates: Value) => {
    setDateRange(dates as [Date, Date]);
    setErrorMessage(''); // Clear error message when date is selected
  };

  const handleSubmit = async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      setErrorMessage('Please select a valid date range.');
      return;
    }

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

  const handleCancel = () => {
    // Handle cancel logic here
    setSearchTerm('');
    setDateRange([new Date(), new Date()]);
    setErrorMessage(''); // Clear error message on cancel
    router.back();
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
    <div>
      {/* Time Period and Calendar Section */}
      <div className="col-span-3 flex flex-col border border-r-2 border-bg-stroke rounded-lg shadow-md">
        <div className="bg-black text-left">
          <h2 className="text-white text-center text-lg p-4">
            {props.type === 'consumer'
              ? `${consumerData?.address} ${consumerData?.suburb_post_code} ${consumerData?.suburb_name}`
              : `${suburbData?.name} ${suburbData?.postcode} ${suburbData?.state}`}
          </h2>
        </div>
        <div className="p-4 bg-itembg">
          <Calendar
            selectRange
            value={dateRange}
            onChange={handleDateChange}
            className="mb-6 mx-5"
            showNeighboringMonth={false}
            maxDate={new Date()}
          />
          <div className="text-white font-italic mx-5">{formatDateRange()}</div>
          {errorMessage && (
            <div className="text-red-500 text-center mt-2">{errorMessage}</div>
          )}
        </div>
        <div className="flex p-4 bg-itembg items-center justify-around">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2 bg-red text-white rounded-lg shadow-md hover:bg-opacity-75 transition duration-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-purple text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportForm;

'use client'; // Ensure this file is treated as a client-side component

import React from 'react';
import Link from 'next/link'; // Import the Link component
import { consumers } from 'stream';

const ReportFormButton = (props: { id: string; type: string }) => {
  return (
    <Link
      href={{
        pathname: '/main/reportForm',
        query: {
          id: props.id,
          type: props.type,
        },
      }}
    >
      <button className="px-4 py-2 bg-purple text-white rounded shadow-md">
        Generate Report
      </button>
    </Link>
  );
};

export default ReportFormButton;

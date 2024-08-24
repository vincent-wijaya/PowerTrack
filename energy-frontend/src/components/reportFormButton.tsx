'use client'; // Ensure this file is treated as a client-side component

import React from 'react';
import Link from 'next/link'; // Import the Link component

const ReportFormButton = () => {
  return (
    <Link href="/main/reportForm">
      {/* Replace '/page' with the path of the page you want to navigate to */}
      <button className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-purple text-white rounded shadow-md">
        Generate Report
      </button>
    </Link>
  );
};

export default ReportFormButton;

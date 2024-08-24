'use client'; // Ensure this file is treated as a client-side component

import React from 'react';
import Link from 'next/link'; // Import the Link component
import { consumers } from 'stream';

const ReportFormButton = (props: { id: string; type: string }) => {
  return (
<<<<<<< HEAD
    <Link href="/main/reportForm">
      {/* Replace '/page' with the path of the page you want to navigate to */}
      <button className="px-4 py-2 bg-purple text-white rounded shadow-md">
=======
    <Link
      href={{
        pathname: '/main/reportForm',
        query: {
          id: props.id,
          type: props.type,
        },
      }}
    >
      <button className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-purple text-white rounded shadow-md">
>>>>>>> 202f21b77136dd78c6133c620e3a650fc5584929
        Generate Report
      </button>
    </Link>
  );
};

export default ReportFormButton;

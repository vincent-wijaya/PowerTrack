'use client'

import Headings from '@/app/main/template';
import PageHeading from '@/components/pageHeading';
import RegionalTable from '@/components/tables/regionalTable';
import UserTable from '@/components/tables/userTable';
import { useState } from 'react';

export default function LiveViewDashboard() {
  // State to track which table to show
  const [showUserTable, setShowUserTable] = useState(false);

  const toggleTable = () => {
    setShowUserTable((prev) => !prev);
  };

  return (
    <>
      <PageHeading title="Live View Dashboard" />
      <div>
      <label className="inline-flex items-center cursor-pointer pt-4">
        <input 
          type="checkbox" 
          className="sr-only peer" 
          checked={showUserTable} 
          onChange={toggleTable} 
        />
        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none ring-4 ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        <span className="ms-3 font-medium text-gray-900 dark:text-gray-300 text-white">
          {showUserTable ? 'Consumers' : 'Suburbs'}
        </span>
      </label>
      </div>
      <div className="gap-8">
        <div className="py-8">
          {showUserTable ? <UserTable /> : <RegionalTable />}
        </div>
      </div>
    </>
  );
}

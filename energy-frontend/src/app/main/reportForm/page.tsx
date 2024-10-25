import React from 'react';
import ReportForm from '@/components/reportForm';

const Page = (params: { searchParams: any }) => {
  const qs = params.searchParams;
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <ReportForm
        id={decodeURI(qs.id)}
        type={decodeURI(qs.type)}
      />
    </div>
  );
};

export default Page;

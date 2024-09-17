import React, { useEffect, useState } from 'react';
import PageHeading from '@/components/pageHeading';
import WarningTable from '@/components/tables/warningTable';

export default function WarningsPage() {
  return (
    <>
      <PageHeading title="Warnings" />
      <div className="flex gap-6">
        <WarningTable />
      </div>
    </>
  );
}

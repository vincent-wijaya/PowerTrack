'use client';

import React, { useEffect, useState } from 'react';
import PageHeading from '@/components/pageHeading';
import WarningTable from '@/components/tables/warningTable';
import InfoBox from '@/components/infoBoxes/infoBox';
import { fetcher } from '@/utils';
import useSWR from 'swr';

export default function WarningsPage() {
  // Access the warnings array directly
  const { data: warningData, error: warningError } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/warnings`,
    fetcher,
    {
      refreshInterval: 0,
    }
  );

  return (
    <>
      <PageHeading title="Warnings" />
      <div className="flex flex-col pt-4 gap-6">
        {' '}
        {/* Stacking items vertically */}
        <div className="flex justify-between gap-3">
          {' '}
          {/* Align InfoBoxes horizontally */}
          <InfoBox
            title={`${warningData?.warnings?.length || 0} Warnings`}
            description=""
          />
          <InfoBox
            title={`${warningData?.warnings?.length || 0} Suggestions`}
            description=""
          />
        </div>
        <WarningTable /> {/* Table below the InfoBoxes */}
      </div>
    </>
  );
}

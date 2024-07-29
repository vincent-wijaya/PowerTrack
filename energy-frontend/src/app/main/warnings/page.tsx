import React, { useEffect, useState } from 'react';
import PageHeading from '@/components/pageHeading';
import EnergyChart from '@/components/energyChart';
import ProfitChart from '@/components/profitChart';

export default function WarningsPage() {
  return (
    <>
      <div className="flex flex-col-2">
        <PageHeading title="Warnings" />
      </div>
    </>
  );
}

'use client';

import ListMenu from './listMenu';
import HomeIcon from './icons/homeIcon';
import WarningIcon from './icons/warningsIcon';
import GoalsIcon from './icons/goalsIcon';
import ReportsIcon from './icons/reportsIcon';
import LogoutIcon from './icons/logoutIcon';
import Home from '@/app/page';
import { useState } from 'react';

interface InfoBoxProps {
  isOpen: boolean;
}

export default function Navbar({ isOpen }: InfoBoxProps) {
  return (
    <>
      {!isOpen && ( // Only render the Navbar if isHidden is false
        <div className="h-screen inline-flex flex-col justify-between items-start border-navbarbg bg-navbarbg">
          {/* start of top of search bar */}
          <div className="flex flex-col items-start self-stretch">
            {/* start of top of profile */}
            <div className="flex items-center p-4">
              {/* start of avatar */}
              {/* end of avatar */}
              <div className="flex flex-col justify-center items-start">
                <div className="text-white text-base font-bold">Retailer</div>
                <div className="text-gray">Retailer@Aus</div>
              </div>
            </div>
            <div className="flex flex-col items-start">
              <ListMenu
                icon={<HomeIcon />}
                description="Home"
                href="/mainDashboard"
              />
              <ListMenu
                icon={<GoalsIcon />}
                description="Goals"
                href="/goals"
              />
              <ListMenu
                icon={<WarningIcon />}
                description="Warnings"
                href="/warnings"
              />
              <ListMenu
                icon={<ReportsIcon />}
                description="Reports"
                href="/reportsDashboard"
              />
            </div>
          </div>
          <div className="flex flex-col items-start self-stretch">
            <ListMenu
              icon={<LogoutIcon />}
              description="Logout"
              href="/mainDashboard"
            />
          </div>
        </div>
      )}
    </>
  );
}

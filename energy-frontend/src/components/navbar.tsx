'use client';

import ListMenu from './listMenu';
import HomeIcon from './icons/homeIcon';
import WarningIcon from './icons/warningsIcon';
import GoalsIcon from './icons/goalsIcon';
import ReportsIcon from './icons/reportsIcon';
import LogoutIcon from './icons/logoutIcon';
import LiveIcon from './icons/liveIcon';
import Home from '@/app/page';
import { useState } from 'react';

interface InfoBoxProps {
  isOpen: boolean;
}

export default function Navbar({ isOpen }: InfoBoxProps) {
  return (
    <>
      {!isOpen && (
        <div className="border-navbarbg bg-navbarbg h-screen flex flex-col justify-between">
          {/* top section */}
          <div>
            <div className="flex items-center p-4">
              <div className="flex flex-col justify-center items-start">
                <div className="text-white text-base font-bold">Retailer</div>
                <div className="text-gray">Retailer@Aus</div>
              </div>
            </div>
            <div className="flex flex-col">
              <ListMenu
                icon={<HomeIcon />}
                description="Home"
                href="/main/mainDashboard"
              />
              <ListMenu
                icon={<WarningIcon />}
                description="Warnings"
                href="/main/warnings"
              />
              <ListMenu
                icon={<ReportsIcon />}
                description="Reports"
                href="/main/reportsDashboard"
              />
              <ListMenu
                icon={<LiveIcon />}
                description="LiveViews"
                href="/main/liveViews"
              />
            </div>
          </div>
          {/* bottom section */}
          <div className="flex flex-col">
            <ListMenu
              icon={<LogoutIcon />}
              description="Logout"
              href="/login"
            />
          </div>
        </div>
      )}
    </>
  );
}
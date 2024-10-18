'use client';

import ListMenu from './listMenu';
import HomeIcon from './icons/homeIcon';
import WarningIcon from './icons/warningsIcon';
import GoalsIcon from './icons/goalsIcon';
import ReportsIcon from './icons/reportsIcon';
import LogoutIcon from './icons/logoutIcon';
import LiveIcon from './icons/liveIcon';

interface NavbarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Navbar({ isOpen, onClose }: NavbarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="w-1/6 absolute inset-0 z-50 bg-navbarbg flex flex-col justify-between transition-opacity duration-300"
          style={{ opacity: isOpen ? 1 : 0 }}
        >
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
          {/* Close Button on Right Side */}
          <div className="absolute top-0 right-0 p-4">
            <button
              onClick={onClose}
              className="text-white text-lg focus:outline-none hover:text-gray-400 transition duration-200"
            >
              &times;
            </button>
          </div>
          {/* bottom section */}
          <div className="flex flex-col"></div>
        </div>
      )}
    </>
  );
}

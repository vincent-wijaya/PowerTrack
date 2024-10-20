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
  id: string;
}

export default function Navbar({ isOpen, onClose, id }: NavbarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="w-full sm:w-1/6 absolute inset-0 z-50 bg-navbarbg flex flex-col justify-between transition-opacity duration-300"
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
            <div className="flex flex-col justify-center items-start">
              <ListMenu
                icon={<HomeIcon aria-label="Home icon" />}
                description="Home"
                href={`/main/mainDashboard/${id}`}
              />
              <ListMenu
                icon={<ReportsIcon aria-label="Reports icon" />}
                description="Reports"
                href={`/main/reportsDashboard/${id}`}
              />
            </div>
          </div>
          {/* Close Button on Right Side */}
          <div className="absolute top-0 right-0 p-4">
            <button
              onClick={onClose}
              className="text-white text-lg focus:outline-none hover:text-gray-400 transition duration-200"
              aria-label="Close menu"
            >
              &times;
            </button>
          </div>
          {/* bottom section */}
          <div className="flex flex-col">
            <ListMenu
              icon={<LogoutIcon aria-label="Logout icon" />}
              description="Logout"
              href="/login"
            />
          </div>
        </div>
      )}
    </>
  );
}

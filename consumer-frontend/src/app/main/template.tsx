'use client';

import React, { ReactNode, useState } from 'react';
import Navbar from '@/components/navbar';
import ProfileIcon from '@/components/icons/profileIcon';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation'; // Use useSearchParams and usePathname from next/navigation

interface TemplateProps {
  children: ReactNode;
}

export default function Template({ children }: TemplateProps) {
  const [isNavbarOpen, setIsNavbarOpen] = useState(false);
  // Use useSearchParams to access the query parameters
  const searchParams = useSearchParams();
  const pathname = usePathname(); // Use usePathname to access the current path
  const toggleNavbar = () => {
    setIsNavbarOpen((prev) => !prev);
  };

  const id = pathname.split('/').pop(); // This will give you the '123' from the URL

  return (
    
    <div className="relative flex h-screen overflow-hidden">
      
      {/* Navbar overlay */}
      <Navbar isOpen={isNavbarOpen} onClose={() => setIsNavbarOpen(false)} id={id}/>

      {/* Main Content */}
      <div
        className={`flex flex-col w-full transition-filter duration-100 ease-in-out ${
          isNavbarOpen ? 'filter blur-lg' : ''
        }`}
      >
        {/* Header with "POWER TRACK" and menu toggle */}
        <div className="flex justify-between items-center py-6 px-10 bg-black">
        <button
            onClick={toggleNavbar}
            className="text-white text-lg focus:outline-none"
          >
            {isNavbarOpen ? <ProfileIcon/> : <ProfileIcon/>}
          </button>
          <Link href="/main/mainDashboard"> {/* Wrap the title in Link */}
            <div className="text-xl text-white italic cursor-pointer"> {/* Add cursor-pointer for better UX */}
              POWER TRACK
            </div>
          </Link>
          
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-10 py-4 bg-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
}

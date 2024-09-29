'use client';

import React, { ReactNode, useState } from 'react';

interface TemplateProps {
  children: ReactNode;
}

export default function Template({ children }: TemplateProps) {
  const [isNavbarOpen, setIsNavbarOpen] = useState(false);

  const toggleNavbar = () => {
    console.log('clicked');
    setIsNavbarOpen((prev) => !prev);
  };

  return (
    <div className="flex overflow-hidden">
      <div className="flex flex-col w-full">
        {' '}
        {/* Adjust the margin-left according to the navbar width */}
        <div className="flex justify-between items-center py-6 px-10 bg-gray-800">
          <div className="text-xl text-white">POWER TRACK</div>
        </div>
        <div className="flex-1 overflow-y-auto px-10 py-4 bg-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { ReactNode, useState } from "react";
import Profile from "../components/profile";
import Navbar from "../components/navbar";

interface TemplateProps {
  children: ReactNode;
}

export default function Template({ children }: TemplateProps) {
  const [isNavbarOpen, setIsNavbarOpen] = useState(false);

  const toggleNavbar = () => {
    console.log("clicked");
    setIsNavbarOpen((prev) => !prev);
  };

  return (
    <div className="flex">
      <Navbar isOpen={isNavbarOpen} />
      <div className="flex flex-col w-full">
        <div className="flex justify-between items-center py-6 px-10">
          <div className="text -1xl text-white">POWER TRACK</div>
          <Profile click={toggleNavbar} />
        </div>
        <div className="flex flex-col px-10">{children}</div>
      </div>
    </div>
  );
}

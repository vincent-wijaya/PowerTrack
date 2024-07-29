'use client'

import React, { useState } from "react";
import Profile from "./profile";
import Navbar from "./navbar";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {

    const [isNavbarOpen, setIsNavbarOpen] = useState(false);
  
    const toggleNavbar = () => {
      console.log('clicked')
      setIsNavbarOpen((prev) => !prev);
    };
    
  return (
      <div className="flex">
        <Navbar isOpen={isNavbarOpen}/>
        <div className="flex flex-col-2">
          <div >
            <div className="text -1xl text-white p-10">POWER TRACK</div>
            <div className="text-3xl text-white px-10">{title}</div>;
          </div>
          <div className="absolute top-0 right-0 p-10">
            <Profile click={toggleNavbar} />
          </div>
        </div>
        
      </div>
  );
}


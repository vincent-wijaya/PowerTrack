'use client';
// src/app/page.tsx

import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to MainDashboard directly
  redirect('/main/mainDashboard');

  return null; // You can return a loading indicator here if needed
}

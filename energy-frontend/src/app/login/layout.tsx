import Navbar from '@/components/navbar';
import InfoBox from '@/components/infoBoxes/infoBox';
import Template from '@/app/main/template';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Power Track',
  description: 'Energy consumption monitoring application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="flex-grow">{children}</div>;
}

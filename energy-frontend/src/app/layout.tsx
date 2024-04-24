
import Navbar from "@/components/navbar";
import InfoBox from "@/components/infoBox";
import Header from "@/components/header";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Power Track",
  description: "Energy consumption monitoring application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en">
      <body className={inter.className + " bg-mainbg"}>
        <div className="flex">
          <main className="flex-grow">{children}</main>
        </div>
      </body>
    </html>
  );
}

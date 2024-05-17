import Navbar from "@/components/navbar";
import InfoBox from "@/components/infoBox";
import Template from "@/app/template";
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
        <main className="flex-grow">{children}</main>
      </body>
    </html>
  );
}

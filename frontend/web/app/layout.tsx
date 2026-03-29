import type { Metadata, Viewport } from "next";
import { Inter, Outfit, Arimo } from 'next/font/google'
import "./globals.css";
import SidebarLayout from "./nav/SidebarLayout";
import TopBar from "./nav/TopBar";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const arimo = Arimo({ subsets: ['latin'], variable: '--font-arimo' })

export const metadata: Metadata = {
  title: "Planora",
  description: "Manage projects with Planora",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} ${arimo.variable} antialiased bg-[#F4F5F7]`}>
        {children}
      </body>
    </html>
  );
}

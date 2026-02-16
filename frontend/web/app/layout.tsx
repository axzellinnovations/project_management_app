import type { Metadata, Viewport } from "next";
import { Inter, Outfit, Arimo } from 'next/font/google'
import "./globals.css";
import Sidebar from "./nav/Sidebar";
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
        <div className="flex h-screen overflow-hidden">
          {/* Global Sidebar (Fixed) */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Global TopBar (Fixed at top of this column) */}
            <TopBar />

            {/* Scrollable Page Content */}
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import React from "react";
import { Inter, Outfit, Arimo } from 'next/font/google'
import "./globals.css";
import "react-international-phone/style.css";

import { NavigationProvider } from "@/lib/navigation-context";
import { ToastProvider } from "@/components/ui/Toast";
import { GlobalNotificationProvider } from "@/components/providers/GlobalNotificationProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import KeyboardShortcutsProvider from "@/components/providers/KeyboardShortcutsProvider";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', preload: false })
const arimo = Arimo({ subsets: ['latin'], variable: '--font-arimo', preload: false })


export const metadata: Metadata = {
  title: "Planora",
  description: "Manage projects with Planora",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Planora',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
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
      <body className={`${inter.variable} ${outfit.variable} ${arimo.variable} antialiased font-inter bg-cu-bg-secondary`}>
        <NavigationProvider>
          <ThemeProvider>
            <ToastProvider>
              <GlobalNotificationProvider>
                <KeyboardShortcutsProvider />
                <Suspense fallback={null}>
                  {children}
                </Suspense>
              </GlobalNotificationProvider>
            </ToastProvider>
          </ThemeProvider>
        </NavigationProvider>
      </body>
    </html>
  );
}

'use client';

import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F1F6F9] py-12 sm:px-6 lg:px-8">
      {/* Shared Logo Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6">
        <Link href="/" className="flex items-center justify-center gap-2">
          {/* Simple Logo Icon */}
          <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-3xl font-bold text-gray-900 tracking-tight">Planora</span>
        </Link>
      </div>

      {/* The Page Content (Login/Register) goes here */}
      <div className="w-full sm:max-w-[480px]">
        {children}
      </div>
    </div>
  );
}
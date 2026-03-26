import { Suspense } from 'react';
import Sidebar from '../nav/Sidebar';
import TopBar from '../nav/TopBar';

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div className="h-[119px] bg-gray-50" />}>
          <TopBar />
        </Suspense>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}

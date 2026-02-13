'use client';

// We only need a simple wrapper now because the pages handle their own UI
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // We just set the base background color and font here.
    // We REMOVED the Logo and Card container because they are already inside your Login/Register pages.
    <div className="min-h-screen w-full bg-[#F8FAFC] font-sans text-gray-900 antialiased">
      {children}
    </div>
  );
}
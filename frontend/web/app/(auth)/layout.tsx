'use client';

// Auth layout: luminous gradient background with radial accent blobs
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full relative overflow-hidden font-sans text-gray-900 antialiased"
      style={{
        background: 'hsl(210, 40%, 98%)',
      }}
    >
      {/* Background accent blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, hsl(221,83%,60%) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, hsl(260,80%,70%) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, hsl(221,83%,55%) 0%, transparent 60%)' }}
        />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
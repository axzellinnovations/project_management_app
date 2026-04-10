'use client';

/**
 * Chat Layout - Specific handling for chat route
 * 
 * The project-wide Persistent shell is now managed by app/(project)/layout.tsx.
 * This file stays to handle Chat-specific synchronization but re-uses the shared shell.
 */
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full min-h-0 w-full flex flex-col bg-[#F7F8FA]">
      {children}
    </div>
  );
}

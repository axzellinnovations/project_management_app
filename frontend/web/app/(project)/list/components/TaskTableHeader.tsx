export default function TaskTableHeader() {
  return (
    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide sticky top-0 z-10">
      <span className="w-6 shrink-0" />
      <span className="w-1.5 shrink-0" />
      <span className="w-16 shrink-0 hidden lg:block">Priority</span>
      <span className="flex-1 min-w-0">Title</span>
      <span className="w-28 shrink-0 hidden lg:block">Labels</span>
      <span className="w-28 shrink-0 hidden xl:block">Milestone</span>
      <span className="w-28 shrink-0 hidden md:block">Assignee</span>
      <span className="w-28 shrink-0">Status</span>
      <span className="w-20 shrink-0 hidden sm:block">Due</span>
      <span className="w-8 shrink-0" />
    </div>
  );
}

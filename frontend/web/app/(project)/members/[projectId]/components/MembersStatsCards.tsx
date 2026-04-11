interface MembersStatsCardsProps {
  totalMembers: number;
  activeCount: number;
  adminCount: number;
  pendingCount: number;
}

export function MembersStatsCards({
  totalMembers,
  activeCount,
  adminCount,
  pendingCount,
}: MembersStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white rounded-xl shadow p-4 flex flex-row items-center justify-between min-w-[180px]">
        <div>
          <div className="text-gray-500 text-sm mb-1">Total Members</div>
          <div className="text-xl font-semibold text-gray-900">{totalMembers}</div>
        </div>
        <div className="bg-blue-100 rounded-[16px] p-3 flex items-center justify-center">
          <svg className="w-6 h-6 text-[#185ADB]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 32 32">
            <circle cx="16" cy="14" r="5" />
            <path d="M7 26c0-3 4.5-5 9-5s9 2 9 5" />
            <path d="M23 10c1.5 0 3 1.12 3 3s-1.5 3-3 3" />
          </svg>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 flex flex-row items-center justify-between min-w-[180px]">
        <div>
          <div className="text-gray-500 text-sm mb-1">Active</div>
          <div className="text-xl font-semibold text-gray-900">{activeCount}</div>
        </div>
        <div className="bg-green-100 rounded-[16px] p-3 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 32 32">
            <polyline points="4,18 10,18 14,6 18,26 22,14 28,14" />
          </svg>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 flex flex-row items-center justify-between min-w-[180px]">
        <div>
          <div className="text-gray-500 text-sm mb-1">Admins</div>
          <div className="text-xl font-semibold text-gray-900">{adminCount}</div>
        </div>
        <div className="bg-cu-primary/10 rounded-[16px] p-3 flex items-center justify-center">
          <svg className="w-6 h-6 text-cu-primary" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 32 32">
            <polyline points="8,20 12,12 16,18 20,12 24,20" />
            <line x1="10" y1="24" x2="22" y2="24" />
            <line x1="12" y1="22" x2="20" y2="22" />
          </svg>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 flex flex-row items-center justify-between min-w-[180px]">
        <div>
          <div className="text-gray-500 text-sm mb-1">Pending</div>
          <div className="text-xl font-semibold text-gray-900">{pendingCount}</div>
        </div>
        <div className="bg-yellow-100 rounded-[16px] p-3 flex items-center justify-center">
          <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="12" />
            <path d="M16 10v7l5 3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

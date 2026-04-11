interface MembersHeaderProps {
  onInviteClick: () => void;
}

export function MembersHeader({ onInviteClick }: MembersHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Team Members</h1>
        <div className="text-sm sm:text-base text-gray-500 mt-1">Manage your team and their permissions</div>
      </div>
      <button
        className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 min-h-[44px] rounded-[12px] bg-cu-primary text-white font-medium text-sm sm:text-base shadow-md hover:bg-cu-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-300"
        style={{ boxShadow: '0 2px 8px 0 rgba(21,93,252,0.1)' }}
        onClick={onInviteClick}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 shrink-0" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="9" cy="8" r="4" stroke="white" strokeWidth="2" />
          <path d="M17 8v6M20 11h-6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" stroke="white" strokeWidth="2" />
        </svg>
        Invite Member
      </button>
    </div>
  );
}

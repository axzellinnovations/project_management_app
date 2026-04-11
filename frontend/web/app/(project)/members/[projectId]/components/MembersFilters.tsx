interface MembersFiltersProps {
  search: string;
  roleFilter: string | null;
  statusFilter: string | null;
  showFilters: boolean;
  onSearchChange: (value: string) => void;
  onToggleFilters: () => void;
  onRoleFilterChange: (value: string | null) => void;
  onStatusFilterChange: (value: string | null) => void;
}

export function MembersFilters({
  search,
  roleFilter,
  statusFilter,
  showFilters,
  onSearchChange,
  onToggleFilters,
  onRoleFilterChange,
  onStatusFilterChange,
}: MembersFiltersProps) {
  return (
    <>
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          className="flex-1 border rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cu-primary/20"
          placeholder="Search members by name or email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button
          className="border rounded px-4 py-2 flex items-center gap-2 text-sm bg-white hover:bg-gray-50"
          onClick={onToggleFilters}
        >
          <span>Filters</span>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M6 12h12M10 18h4" /></svg>
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-4 mb-4">
          <select
            className="border rounded px-3 py-2 text-sm"
            value={roleFilter || ''}
            onChange={(e) => onRoleFilterChange(e.target.value || null)}
          >
            <option value="">All Roles</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>

          <select
            className="border rounded px-3 py-2 text-sm"
            value={statusFilter || ''}
            onChange={(e) => onStatusFilterChange(e.target.value || null)}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      )}
    </>
  );
}

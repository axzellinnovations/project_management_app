import type { NotificationFilter } from '../types';

interface NotificationFiltersProps {
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
}

export function NotificationFilters({ filter, onFilterChange }: NotificationFiltersProps) {
  return (
    <div className="flex items-center gap-2 bg-slate-50/80 rounded-xl p-1 w-full sm:w-fit border border-slate-100">
      {([
        { key: 'all', label: 'All' },
        { key: 'unread', label: 'Unread' },
        { key: 'read', label: 'Read' },
      ] as const).map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onFilterChange(option.key)}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all font-outfit ${
            filter === option.key
              ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

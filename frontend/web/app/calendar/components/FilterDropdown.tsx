'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface FilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchablePlaceholder: string;
  widthClassName?: string;
}

const SPECIAL_ALL_VALUES = new Set([
  'All assignees',
  'All standard work types',
  'All sub-tasks',
  'Standard work types',
  'Show full list',
]);

export default function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  searchablePlaceholder,
  widthClassName = 'w-72',
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((item) => item.toLowerCase().includes(normalized));
  }, [options, search]);

  const handleToggle = (value: string) => {
    if (SPECIAL_ALL_VALUES.has(value)) {
      onChange([]);
      return;
    }

    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }

    onChange([...selected, value]);
  };

  const buttonLabel = selected.length > 0 ? `${label}: ${selected.length}` : label;

  return (
    <div className={`relative ${widthClassName}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-left text-sm text-[#344054] hover:border-[#98A2B3]"
      >
        <span className="truncate">{buttonLabel}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 max-h-80 w-full overflow-hidden rounded-lg border border-[#E4E7EC] bg-white shadow-xl">
          <div className="border-b border-[#F2F4F7] p-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchablePlaceholder}
              className="w-full rounded-md border border-[#D0D5DD] px-2.5 py-1.5 text-sm outline-none focus:border-[#175CD3]"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((item) => {
              const checked = selected.includes(item);
              const isAll = SPECIAL_ALL_VALUES.has(item);

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleToggle(item)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-[#344054] hover:bg-[#F9FAFB]"
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={isAll ? selected.length === 0 : checked}
                    className="h-4 w-4 rounded border-[#D0D5DD]"
                  />
                  <span className="truncate">{item}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-sm text-[#667085]">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

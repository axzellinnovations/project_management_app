import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import 'react-day-picker/dist/style.css';

interface DateSectionProps {
  dates: {
    created: string;
    updated: string;
    dueDate: string | null;
    startDate?: string | null;
  };
  onUpdateDueDate?: (dueDate: string | null) => void;
  onUpdateStartDate?: (startDate: string | null) => void;
}

const DateSection: React.FC<DateSectionProps> = ({ dates, onUpdateDueDate, onUpdateStartDate }) => {
  const [open, setOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  // parseISO is used instead of new Date() to avoid timezone offset issues with bare YYYY-MM-DD strings
  const parsedDueDate = dates.dueDate ? parseISO(dates.dueDate) : undefined;
  const parsedStartDate = dates.startDate ? parseISO(dates.startDate) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (onUpdateDueDate) {
      if (date) {
        onUpdateDueDate(format(date, 'yyyy-MM-dd'));
      } else {
        onUpdateDueDate(null);
      }
    }
    setOpen(false);
  };

  const handleStartSelect = (date: Date | undefined) => {
    if (onUpdateStartDate) {
      if (date) {
        onUpdateStartDate(format(date, 'yyyy-MM-dd'));
      } else {
        onUpdateStartDate(null);
      }
    }
    setStartOpen(false);
  };

  return (
    <div className="border rounded-md border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">Dates</div>
      <div className="p-4 space-y-4">
        {dates.dueDate !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Due date</span>
            {onUpdateDueDate ? (
              <div className="flex items-center gap-2">
                <Popover.Root open={open} onOpenChange={setOpen}>
                  <Popover.Trigger asChild>
                    <button className="flex items-center gap-2 text-sm text-gray-800 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                      <CalendarIcon size={14} className="text-gray-500" />
                      {parsedDueDate ? format(parsedDueDate, 'MMM d, yyyy') : 'No date'}
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    {/* Popover.Portal renders outside the sidebar so overflow:hidden on the modal panel can't clip the calendar */}
                    <Popover.Content className="z-[10000] p-3 bg-white rounded-xl shadow-xl border border-gray-200" sideOffset={5} align="end">
                      <DayPicker
                        mode="single"
                        selected={parsedDueDate}
                        onSelect={handleSelect}
                        showOutsideDays
                      />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
                {parsedDueDate && (
                  <button
                    onClick={() => handleSelect(undefined)}
                    className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    title="Clear date"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                {parsedDueDate ? format(parsedDueDate, 'MMM d, yyyy') : 'No date'}
              </span>
            )}
          </div>
        )}
        {dates.startDate !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Start date</span>
            {onUpdateStartDate ? (
              <div className="flex items-center gap-2">
                <Popover.Root open={startOpen} onOpenChange={setStartOpen}>
                  <Popover.Trigger asChild>
                    <button className="flex items-center gap-2 text-sm text-gray-800 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                      <CalendarIcon size={14} className="text-gray-500" />
                      {parsedStartDate ? format(parsedStartDate, 'MMM d, yyyy') : 'No date'}
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className="z-[10000] p-3 bg-white rounded-xl shadow-xl border border-gray-200" sideOffset={5} align="end">
                      <DayPicker mode="single" selected={parsedStartDate} onSelect={handleStartSelect} showOutsideDays />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
                {parsedStartDate && (
                  <button onClick={() => handleStartSelect(undefined)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Clear date">
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                {parsedStartDate ? format(parsedStartDate, 'MMM d, yyyy') : 'No date'}
              </span>
            )}
          </div>
        )}
        {dates.created && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 font-medium">Created</span>
            <span className="text-xs text-gray-600">{new Date(dates.created).toLocaleString()}</span>
          </div>
        )}
        {dates.updated && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 font-medium">Updated</span>
            <span className="text-xs text-gray-600">{new Date(dates.updated).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DateSection;

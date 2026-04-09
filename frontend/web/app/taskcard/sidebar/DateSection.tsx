'use client';
import React from 'react';

interface DateSectionProps {
  dates: {
    created: string;
    updated: string;
    dueDate: string;
  };
  onUpdateDueDate?: (dueDate: string) => void;
}

const DateSection: React.FC<DateSectionProps> = ({ dates, onUpdateDueDate }) => (
  <div className="border rounded-md border-gray-200 bg-white shadow-sm">
    <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">Dates</div>
    <div className="p-4 space-y-4">
      {dates.dueDate && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Due date</span>
          {onUpdateDueDate ? (
            <input
              type="date"
              defaultValue={dates.dueDate ? dates.dueDate.substring(0, 10) : ''}
              onChange={(e) => { if (e.target.value) onUpdateDueDate(e.target.value); }}
              className="text-sm text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            />
          ) : (
            <span className="text-sm text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-100">
              {new Date(dates.dueDate).toLocaleDateString()}
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

export default DateSection;

'use client';

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, X } from 'lucide-react';
import { DateFilter } from '../types';

interface DateRangeFilterProps {
  onFilterChange: (filter: DateFilter) => void;
  initialFilter?: DateFilter;
}

export default function DateRangeFilter({
  onFilterChange,
  initialFilter,
}: DateRangeFilterProps) {
  const [startDate, setStartDate] = useState<Date | null>(
    initialFilter?.startDate || null
  );
  const [endDate, setEndDate] = useState<Date | null>(
    initialFilter?.endDate || null
  );
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = () => {
    onFilterChange({ startDate, endDate });
    setIsOpen(false);
  };

  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
    onFilterChange({ startDate: null, endDate: null });
    setIsOpen(false);
  };

  const hasActiveFilter = startDate || endDate;

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors
          ${
            hasActiveFilter
              ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }
        `}
      >
        <Calendar size={18} />
        <span className="text-sm">
          {hasActiveFilter
            ? `${startDate?.toLocaleDateString() || ''} ${endDate ? `- ${endDate.toLocaleDateString()}` : ''}`
            : 'Filter by Date'}
        </span>
      </button>

      {/* Filter Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 min-w-96">
          <div className="space-y-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                dateFormat="MMM d, yyyy"
                minDate={new Date(2020, 0, 1)}
                maxDate={endDate || new Date()}
                placeholderText="Select start date"
                wrapperClassName="w-full"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                dateFormat="MMM d, yyyy"
                minDate={startDate || new Date(2020, 0, 1)}
                maxDate={new Date()}
                placeholderText="Select end date"
                wrapperClassName="w-full"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleApply}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Apply Filter
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Close overlay when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { X, Layout, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateColumn: (name: string, status: string) => Promise<void>;
  loading?: boolean;
}

export default function CreateColumnModal({
  isOpen,
  onClose,
  onCreateColumn,
  loading = false,
}: CreateColumnModalProps) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('TODO');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreateColumn(name.trim(), status);
    setName('');
    setStatus('TODO');
    onClose();
  };

  const statusOptions = [
    { value: 'TODO', label: 'To Do', color: 'bg-blue-500' },
    { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-500' },
    { value: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-500' },
    { value: 'DONE', label: 'Done', color: 'bg-emerald-500' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0c111d]/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md overflow-hidden bg-white rounded-3xl shadow-2xl border border-[#EAECF0]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EAECF0] bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#155DFC]/10 flex items-center justify-center text-[#155DFC]">
                  <Layout size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#101828]">Create New Column</h3>
                  <p className="text-xs text-[#475467]">Organize your sprint workflow</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-[#98A2B3] hover:text-[#101828] hover:bg-gray-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#344054]">Column Name</label>
                <input
                  type="text"
                  placeholder="e.g. QA Testing, Ready for Review"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-3 bg-white border border-[#D0D5DD] rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#155DFC]/10 focus:border-[#155DFC] transition-all placeholder-[#98A2B3]"
                  required
                />
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-[#344054] flex items-center gap-2">
                  Map to Status
                  <div className="group relative">
                    <Info size={14} className="text-[#98A2B3] cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                      This determines the business logic and task progression of the column.
                    </div>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={`
                        flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left
                        ${status === opt.value 
                          ? 'border-[#155DFC] bg-[#155DFC]/5 shadow-sm ring-4 ring-[#155DFC]/5' 
                          : 'border-[#EAECF0] bg-white hover:border-[#D0D5DD]'}
                      `}
                    >
                      <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                      <span className={`text-[13px] font-bold ${status === opt.value ? 'text-[#155DFC]' : 'text-[#344054]'}`}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-white border border-[#D0D5DD] text-[#344054] rounded-xl text-sm font-bold hover:bg-gray-50 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex-1 px-4 py-3 bg-[#155DFC] hover:bg-[#1149C9] text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create Column'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

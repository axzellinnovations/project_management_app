'use client';
import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import KbdKey from './KbdKey';

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  group: string;
  shortcuts: ShortcutRow[];
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    group: 'Global',
    shortcuts: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / dismiss' },
      { keys: ['/'], description: 'Focus search' },
    ],
  },
  {
    group: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'B'], description: 'Go to Backlog' },
      { keys: ['G', 'K'], description: 'Go to Kanban board' },
      { keys: ['G', 'C'], description: 'Go to Calendar' },
    ],
  },
  {
    group: 'Tasks',
    shortcuts: [
      { keys: ['N'], description: 'Create new task' },
      { keys: ['E'], description: 'Edit selected task title' },
      { keys: ['P'], description: 'Change priority' },
      { keys: ['A'], description: 'Assign to me' },
      { keys: ['D'], description: 'Set due date' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ open, onClose }) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Keyboard size={18} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Shortcuts list */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
            {SHORTCUTS.map((section) => (
              <div key={section.group}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {section.group}
                </h3>
                <div className="space-y-2">
                  {section.shortcuts.map((s) => (
                    <div
                      key={s.description}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm text-gray-700">{s.description}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, i) => (
                          <React.Fragment key={k}>
                            {i > 0 && <span className="text-xs text-gray-400">then</span>}
                            <KbdKey>{k}</KbdKey>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-center">
            Press <KbdKey>?</KbdKey> anytime to toggle this panel
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default KeyboardShortcutsModal;

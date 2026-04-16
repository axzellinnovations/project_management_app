'use client';

import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-[#EAECF0] bg-white p-5 shadow-xl">
        <h3 className="flex items-center gap-2 text-base font-bold text-[#101828]"><Keyboard size={16} />Keyboard shortcuts</h3>
        <ul className="mt-3 space-y-2 text-sm text-[#344054]">
          <li><strong>Cmd/Ctrl + K</strong>: Open/close this dialog</li>
          <li><strong>Cmd/Ctrl + B</strong>: Toggle density mode</li>
          <li><strong>Esc</strong>: Close dialogs</li>
        </ul>
        <button onClick={onClose} className="mt-4 rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-sm">Close</button>
      </div>
    </div>
  );
}

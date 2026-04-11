'use client';
import React, { useState } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import KeyboardShortcutsModal from '@/components/ui/KeyboardShortcutsModal';

export default function KeyboardShortcutsProvider() {
  const [open, setOpen] = useState(false);

  useKeyboardShortcuts({
    '?': () => setOpen((v) => !v),
    Escape: () => setOpen(false),
  });

  return <KeyboardShortcutsModal open={open} onClose={() => setOpen(false)} />;
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Hash, MessageSquare, Search } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitColor?: 'blue' | 'red';
}

export function BaseModal({ isOpen, onClose, title, icon, children, onSubmit, submitLabel = 'Save', submitDisabled = false, submitColor = 'blue' }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md pointer-events-auto overflow-hidden flex flex-col"
            >
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                  {icon} {title}
                </h3>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
              <div className="p-5 flex-1 overflow-y-auto">
                {children}
              </div>
              <div className="px-5 py-4 border-t border-gray-50 bg-gray-50 flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-[13.5px] font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onSubmit}
                  disabled={submitDisabled}
                  className={`px-4 py-2 rounded-xl text-[13.5px] font-semibold text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed
                    ${submitColor === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  {submitLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── CREATE CHANNEL MODAL ──
export function CreateChannelModal({ isOpen, onClose, users, onCreate }: {
  isOpen: boolean;
  onClose: () => void;
  users: string[];
  onCreate: (name: string, members: string[]) => void;
}) {
  const [name, setName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setName('');
      setSelectedUsers(new Set());
      setMemberSearch('');
      // Focus the channel name field first
    }
  }, [isOpen]);

  const toggleUser = (u: string) => {
    const next = new Set(selectedUsers);
    if (next.has(u)) next.delete(u);
    else next.add(u);
    setSelectedUsers(next);
    // Keep focus on the search field after toggling
    searchRef.current?.focus();
  };

  const filteredUsers = users.filter(u =>
    !memberSearch.trim() || u.toLowerCase().includes(memberSearch.trim().toLowerCase())
  );

  const handleSubmit = () => {
    onCreate(name.trim(), Array.from(selectedUsers));
    onClose();
  };

  const selectedList = Array.from(selectedUsers);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Channel"
      icon={<Hash size={18} className="text-blue-500" strokeWidth={2.5} />}
      onSubmit={handleSubmit}
      submitLabel="Create"
      submitDisabled={!name.trim() || selectedUsers.size === 0}
    >
      <div className="space-y-4">
        {/* Channel name */}
        <div>
          <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">Channel Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. project-updates"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            autoFocus
          />
        </div>

        {/* Members section */}
        <div>
          <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">
            Add Members {selectedUsers.size > 0 && <span className="text-blue-500">({selectedUsers.size} selected)</span>}
          </label>

          {/* Selected chips row */}
          {selectedList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5 p-2 bg-blue-50 rounded-xl border border-blue-100">
              {selectedList.map(u => (
                <span
                  key={u}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-full text-[12px] font-semibold shadow-sm"
                >
                  <span className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                    {u.charAt(0).toUpperCase()}
                  </span>
                  {u}
                  <button
                    type="button"
                    onClick={() => toggleUser(u)}
                    className="text-blue-400 hover:text-red-400 transition-colors ml-0.5"
                    aria-label={`Remove ${u}`}
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-2 focus-within:bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
            <Search size={13} className="text-gray-400 flex-shrink-0" strokeWidth={2.5} />
            <input
              ref={searchRef}
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members…"
              className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder:text-gray-400 outline-none"
              aria-label="Search members"
            />
            {memberSearch && (
              <button onClick={() => setMemberSearch('')} className="text-gray-300 hover:text-gray-500">
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Filtered member list */}
          <div className="space-y-0.5 max-h-44 overflow-y-auto pr-0.5">
            {users.length === 0 ? (
              <p className="text-[13px] text-gray-500 italic px-1 py-2">No other team members found.</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-[13px] text-gray-400 italic px-2 py-2">No members match "{memberSearch}"</p>
            ) : (
              filteredUsers.map(u => {
                const isSelected = selectedUsers.has(u);
                return (
                  <button
                    key={u}
                    onClick={() => toggleUser(u)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left
                      ${isSelected
                        ? 'bg-blue-50 border-blue-200'
                        : 'border-transparent hover:bg-gray-50 hover:border-gray-100'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold flex-shrink-0
                        ${isSelected ? 'from-blue-500 to-indigo-600' : 'from-gray-400 to-gray-500'}`}>
                        {u.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-[13.5px] font-medium ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>{u}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

// ── EDIT CHANNEL MODAL ──
export function EditChannelModal({ isOpen, onClose, initialName, initialTopic, initialDescription, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialTopic: string;
  initialDescription: string;
  onSave: (updates: { name?: string; topic?: string; description?: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [topic, setTopic] = useState(initialTopic);
  const [desc, setDesc] = useState(initialDescription);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setTopic(initialTopic);
      setDesc(initialDescription);
    }
  }, [isOpen, initialName, initialTopic, initialDescription]);

  const handleSubmit = () => {
    onSave({ name: name.trim() || initialName, topic: topic.trim(), description: desc.trim() });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Channel"
      icon={<Hash size={18} className="text-blue-500" strokeWidth={2.5} />}
      onSubmit={handleSubmit}
      submitLabel="Save Changes"
      submitDisabled={!name.trim()}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">Channel Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">Topic (Optional)</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What is this channel about?"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">Description (Optional)</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
          />
        </div>
      </div>
    </BaseModal>
  );
}

// ── EDIT MESSAGE MODAL ──
export function EditMessageModal({ isOpen, onClose, initialContent, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  initialContent: string;
  onSave: (content: string) => void;
}) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (isOpen) setContent(initialContent);
  }, [isOpen, initialContent]);

  const handleSubmit = () => {
    onSave(content.trim());
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Message"
      icon={<MessageSquare size={18} className="text-blue-500" strokeWidth={2.5} />}
      onSubmit={handleSubmit}
      submitLabel="Save"
      submitDisabled={!content.trim() || content === initialContent}
    >
      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
          autoFocus
        />
      </div>
    </BaseModal>
  );
}

// ── CONFIRM DELETE MODAL ──
export function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title, message, isDeleting = false }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isDeleting?: boolean;
}) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      onSubmit={onConfirm}
      submitLabel={isDeleting ? 'Deleting...' : 'Delete'}
      submitDisabled={isDeleting}
      submitColor="red"
    >
      <p className="text-[14px] text-gray-700 leading-relaxed font-medium">
        {message}
      </p>
    </BaseModal>
  );
}

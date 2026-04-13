"use client";
import React, { useRef, useState } from 'react';
import { Layout, Link2, MoreHorizontal, X, Check, FileText } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/components/ui';

interface TaskHeaderProps {
  project: string;
  taskId: string;
  numericTaskId?: number;
  onClose?: () => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({ project, taskId, numericTaskId, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateInput, setShowTemplateInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openTemplateInput = () => {
    setShowTemplateInput(true);
    setDropdownOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSaveTemplate = async () => {
    if (!numericTaskId || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      await api.post(`/api/tasks/${numericTaskId}/save-as-template`, { templateName: templateName.trim() });
      toast('Template saved successfully', 'success');
      setShowTemplateInput(false);
      setTemplateName('');
    } catch {
      toast('Failed to save template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-b border-[#EAECF0] bg-white/95 backdrop-blur sticky top-0 z-10 flex-shrink-0">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <Layout size={15} className="text-[#155DFC] flex-shrink-0" />
        <span className="font-medium text-[#6A7282] truncate">{project}</span>
        <span className="flex-shrink-0 text-[#9CA3AF]">/</span>
        <span className="text-[#101828] font-semibold flex-shrink-0">{taskId}</span>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {showTemplateInput && (
          <div className="flex items-center gap-1 mr-1">
            <input
              ref={inputRef}
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTemplate();
                if (e.key === 'Escape') { setShowTemplateInput(false); setTemplateName(''); }
              }}
              placeholder="Template name…"
              className="h-8 border border-[#D0D5DD] rounded-lg px-2 text-xs w-40 focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC]"
            />
            <button
              onClick={handleSaveTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="h-8 px-2 bg-[#155DFC] text-white rounded-lg text-xs hover:bg-[#0042A8] disabled:opacity-50 transition-colors"
            >
              {savingTemplate ? '…' : 'Save'}
            </button>
            <button
              onClick={() => { setShowTemplateInput(false); setTemplateName(''); }}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <button
          onClick={handleCopyLink}
          title="Copy link"
          className="p-2 hover:bg-[#F8FAFF] rounded-lg flex items-center gap-1.5 text-[#6A7282] hover:text-[#155DFC] text-xs transition-colors"
        >
          {copied ? <Check size={15} className="text-green-500" /> : <Link2 size={15} />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy link'}</span>
        </button>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="p-2 hover:bg-[#F8FAFF] rounded-lg text-[#6A7282] hover:text-[#155DFC] transition-colors"
            title="More options"
          >
            <MoreHorizontal size={18} />
          </button>
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-20 py-1">
                <button
                  onClick={openTemplateInput}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F8FAFF] transition-colors"
                >
                  <FileText size={15} className="text-gray-400" />
                  Save as Template
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#FFF0F0] rounded-lg text-[#6A7282] hover:text-red-500 transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default TaskHeader;
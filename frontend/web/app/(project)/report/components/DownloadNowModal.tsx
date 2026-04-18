'use client';

// ══════════════════════════════════════════════════════════════════════════════
//  DownloadNowModal.tsx  ·  Format picker + instant download modal
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FileText, Table2, Sparkles, Download,
  CheckCircle2, Loader2, AlertTriangle,
} from 'lucide-react';
import { downloadProjectReport } from '@/services/report-download-service';

type DlState = 'idle' | 'loading' | 'done' | 'error';
type Format  = 'pdf' | 'excel' | 'both';

interface Props {
  open:         boolean;
  onClose:      () => void;
  projectId:    number;
  projectName:  string;
}

const FORMAT_OPTIONS: {
  id: Format; label: string; ext: string; desc: string;
  color: string; bg: string; Icon: React.ElementType;
}[] = [
  {
    id: 'pdf', label: 'PDF Report',      ext: '.pdf',      desc: 'Print-ready branded document',
    color: '#DC2626', bg: '#FFF5F5',     Icon: FileText,
  },
  {
    id: 'excel', label: 'Excel Workbook', ext: '.xlsx',     desc: 'Multi-sheet color-coded spreadsheet',
    color: '#16A34A', bg: '#F0FDF4',     Icon: Table2,
  },
  {
    id: 'both', label: 'Both Formats',   ext: 'PDF + XLSX', desc: 'Complete download package',
    color: '#155DFC', bg: '#EBF2FF',     Icon: Sparkles,
  },
];

export default function DownloadNowModal({ open, onClose, projectId, projectName }: Props) {
  const [format, setFormat]     = useState<Format>('both');
  const [pdfState, setPdf]      = useState<DlState>('idle');
  const [xlState, setXl]        = useState<DlState>('idle');

  const isLoading = pdfState === 'loading' || xlState === 'loading';
  const doPdf     = format === 'pdf'   || format === 'both';
  const doExcel   = format === 'excel' || format === 'both';

  const bothState: DlState =
    pdfState === 'loading' || xlState === 'loading' ? 'loading' :
    pdfState === 'done'    && xlState === 'done'    ? 'done'    :
    pdfState === 'error'   || xlState === 'error'   ? 'error'   : 'idle';

  const currentState =
    format === 'pdf' ? pdfState : format === 'excel' ? xlState : bothState;

  const allDone =
    (format === 'pdf'   && pdfState === 'done')  ||
    (format === 'excel' && xlState  === 'done')  ||
    (format === 'both'  && pdfState === 'done' && xlState === 'done');

  const handleDownload = useCallback(async () => {
    if (isLoading) return;
    if (doPdf)   setPdf('loading');
    if (doExcel) setXl('loading');

    try {
      if (doPdf) {
        await downloadProjectReport(projectId, 'pdf');
        setPdf('done');
      }
    } catch { setPdf('error'); }

    try {
      if (doExcel) {
        await downloadProjectReport(projectId, 'excel');
        setXl('done');
      }
    } catch { setXl('error'); }

    setTimeout(() => { setPdf('idle'); setXl('idle'); }, 8000);
  }, [isLoading, doPdf, doExcel, projectId]);

  const handleClose = () => {
    if (isLoading) return;
    setPdf('idle'); setXl('idle');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[3px]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(24px) saturate(200%)',
                border: '1px solid rgba(255,255,255,0.6)',
              }}
            >
              {/* Header */}
              <div
                className="px-6 py-5 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg,#155DFC 0%,#4D8BFF 100%)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <Download size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-black text-white leading-tight">Download Now</h2>
                    <p className="text-[11px] text-white/70 mt-0.5">{projectName}</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/15 hover:bg-white/25 text-white transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4">
                  Choose Report Format
                </p>

                {/* Format cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {FORMAT_OPTIONS.map(f => {
                    const selected = format === f.id;
                    return (
                      <motion.button
                        key={f.id}
                        onClick={() => setFormat(f.id)}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        className="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center cursor-pointer transition-all duration-150"
                        style={{
                          background:   selected ? f.bg    : '#FAFAFA',
                          borderColor:  selected ? f.color : '#E5E7EB',
                          boxShadow:    selected ? `0 4px 16px ${f.color}22` : 'none',
                        }}
                      >
                        <AnimatePresence>
                          {selected && (
                            <motion.div
                              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                              className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: f.color }}
                            >
                              <CheckCircle2 size={10} className="text-white" />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: selected ? f.color : `${f.color}18` }}
                        >
                          <f.Icon size={16} style={{ color: selected ? '#fff' : f.color }} />
                        </div>
                        <p className="text-[11px] font-bold leading-tight"
                           style={{ color: selected ? f.color : '#374151' }}>
                          {f.label}
                        </p>
                        <span
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: `${f.color}16`, color: f.color }}
                        >
                          {f.ext}
                        </span>
                        <p className="text-[10px] text-[#9CA3AF] leading-snug">{f.desc}</p>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Download button */}
                <motion.button
                  onClick={handleDownload}
                  disabled={isLoading}
                  whileHover={{ scale: isLoading ? 1 : 1.015 }}
                  whileTap={{ scale: isLoading ? 1 : 0.985 }}
                  className="w-full h-12 rounded-xl font-bold text-[13px] text-white flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed select-none"
                  style={{
                    background: allDone
                      ? 'linear-gradient(135deg,#16A34A,#22C55E)'
                      : currentState === 'error'
                        ? 'linear-gradient(135deg,#DC2626,#EF4444)'
                        : isLoading
                          ? '#E5E7EB'
                          : 'linear-gradient(135deg,#155DFC 0%,#4D8BFF 100%)',
                    color: isLoading && !allDone ? '#9CA3AF' : '#fff',
                    boxShadow: isLoading ? 'none' : '0 4px 20px rgba(21,93,252,0.35)',
                  }}
                >
                  {isLoading ? (
                    <><Loader2 size={15} className="animate-spin" style={{ color: '#9CA3AF' }} /> Generating…</>
                  ) : allDone ? (
                    <><CheckCircle2 size={15} /> Downloaded Successfully!</>
                  ) : currentState === 'error' ? (
                    <><AlertTriangle size={15} /> Failed — Click to Retry</>
                  ) : (
                    <><Download size={15} />
                      {format === 'pdf' ? 'Download PDF' : format === 'excel' ? 'Download Excel' : 'Download PDF + Excel'}
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

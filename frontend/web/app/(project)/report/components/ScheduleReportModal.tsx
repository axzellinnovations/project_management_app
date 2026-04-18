'use client';

// ══════════════════════════════════════════════════════════════════════════════
//  ScheduleReportModal.tsx  ·  Multi-step scheduling wizard
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, RefreshCw, FileText, Table2, Sparkles,
  CheckCircle2, Loader2,
  AlertTriangle, ChevronLeft, ChevronRight, CalendarClock,
} from 'lucide-react';
import EmailChipInput from './EmailChipInput';
import {
  createScheduledReport,
  ReportFormat, ScheduleType, Frequency, EndType,
  ScheduledReportRequest,
} from '@/services/report-schedule-service';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  open:       boolean;
  onClose:    () => void;
  projectId:  number;
  projectName: string;
}

interface FormState {
  // Step 1
  scheduleType:       ScheduleType | '';
  // Step 2 - format
  format:             ReportFormat | '';
  // Step 2 - timing
  scheduledDate:      string;   // YYYY-MM-DD (one-time)
  sendTime:           string;   // HH:mm
  frequency:          Frequency | '';
  customIntervalDays: string;
  sendDayOfWeek:      string;   // 0-6
  sendDayOfMonth:     string;   // 1-31
  // Step 3 - recipients
  recipientsTo:       string[];
  recipientsCc:       string[];
  recipientsBcc:      string[];
  // Step 4 - message
  subject:            string;
  bodyMessage:        string;
  // Step 5 - end condition (recurring)
  endType:            EndType | '';
  endAfterCount:      string;
  endDate:            string;   // YYYY-MM-DD
}

const EMPTY_FORM: FormState = {
  scheduleType: '', format: '',
  scheduledDate: '', sendTime: '08:00',
  frequency: '', customIntervalDays: '1',
  sendDayOfWeek: '1', sendDayOfMonth: '1',
  recipientsTo: [], recipientsCc: [], recipientsBcc: [],
  subject: '', bodyMessage: '',
  endType: '', endAfterCount: '5', endDate: '',
};

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepDot({ n, current, label }: { n: number; current: number; label: string }) {
  const done    = n < current;
  const active  = n === current;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-200 ${
          done   ? 'bg-[#16A34A] text-white' :
          active ? 'bg-[#155DFC] text-white ring-4 ring-[#155DFC]/20' :
                   'bg-[#F3F4F6] text-[#9CA3AF]'
        }`}
      >
        {done ? <CheckCircle2 size={13} /> : n}
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-[#155DFC]' : 'text-[#9CA3AF]'}`}>
        {label}
      </span>
    </div>
  );
}

// ── Segmented control ──────────────────────────────────────────────────────────

function SegControl<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; Icon?: React.ElementType; desc?: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map(o => {
        const sel = value === o.value;
        return (
          <motion.button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer ${
              sel ? 'border-[#155DFC] bg-[#EBF2FF]' : 'border-[#E5E7EB] bg-white hover:border-[#155DFC]/30'
            }`}
          >
            {o.Icon && (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: sel ? '#155DFC' : '#F3F4F6' }}
              >
                <o.Icon size={17} style={{ color: sel ? '#fff' : '#6B7280' }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-bold ${sel ? 'text-[#155DFC]' : 'text-[#1F2937]'}`}>{o.label}</p>
              {o.desc && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{o.desc}</p>}
            </div>
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                sel ? 'border-[#155DFC] bg-[#155DFC]' : 'border-[#D1D5DB]'
              }`}
            >
              {sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Field helpers ──────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5 block">{children}</label>;
}

function TextInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white/80 text-[12px] text-[#1F2937] outline-none
                 focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/10 transition-all"
      style={{ fontSize: '12px' }}
    />
  );
}

function SelectInput({
  value, onChange, children,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white/80 text-[12px] text-[#1F2937] outline-none
                 focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/10 transition-all cursor-pointer"
      style={{ fontSize: '12px' }}
    >
      {children}
    </select>
  );
}

// ── Summary row ────────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#F3F4F6] last:border-0">
      <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-[12px] font-semibold text-[#1F2937] flex-1 break-all">{value || '—'}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ScheduleReportModal({ open, onClose, projectId, projectName }: Props) {
  const [step, setStep]         = useState(1);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]     = useState<Partial<Record<keyof FormState, string>>>({});
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const totalSteps = form.scheduleType === 'RECURRING' ? 6 : 5;

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(p => ({ ...p, [key]: val }));

  // ── Validation per step ──────────────────────────────────────────────────────

  const validate = (s: number): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};

    if (s === 1) {
      if (!form.scheduleType) errs.scheduleType = 'Please select a schedule type.';
    }

    if (s === 2) {
      if (!form.format) errs.format = 'Please select a report format.';
      if (!form.sendTime) errs.sendTime = 'Please specify a send time.';

      if (form.scheduleType === 'ONE_TIME') {
        if (!form.scheduledDate) errs.scheduledDate = 'Please pick a date.';
        else if (new Date(form.scheduledDate) < new Date(new Date().toDateString())) {
          errs.scheduledDate = 'Date must be today or in the future.';
        }
      } else {
        if (!form.frequency) errs.frequency = 'Please select a frequency.';
        if (form.frequency === 'CUSTOM' && (!form.customIntervalDays || Number(form.customIntervalDays) < 1)) {
          errs.customIntervalDays = 'Interval must be at least 1 day.';
        }
      }
    }

    if (s === 3) {
      if (form.recipientsTo.length === 0) errs.recipientsTo = 'At least one recipient is required.';
    }

    if (s === 4 && form.scheduleType === 'RECURRING') {
      if (!form.endType) errs.endType = 'Please select when the recurring schedule should end.';
      if (form.endType === 'AFTER_N' && (!form.endAfterCount || Number(form.endAfterCount) < 1)) {
        errs.endAfterCount = 'Must be at least 1.';
      }
      if (form.endType === 'UNTIL_DATE' && !form.endDate) {
        errs.endDate = 'Please pick an end date.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => { if (validate(step)) setStep(s => s + 1); };
  const back = () => setStep(s => Math.max(1, s - 1));

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (saveState === 'loading') return;
    setSaveState('loading');

    const payload: ScheduledReportRequest = {
      projectId,
      format:        form.format as ReportFormat,
      scheduleType:  form.scheduleType as ScheduleType,
      sendTime:      form.sendTime,
      recipientsTo:  form.recipientsTo,
      ...(form.recipientsCc.length  && { recipientsCc:  form.recipientsCc }),
      ...(form.recipientsBcc.length && { recipientsBcc: form.recipientsBcc }),
      ...(form.subject               && { subject:       form.subject }),
      ...(form.bodyMessage           && { bodyMessage:   form.bodyMessage }),
    };

    if (form.scheduleType === 'ONE_TIME') {
      payload.scheduledDate = form.scheduledDate;
    } else {
      payload.frequency = form.frequency as Frequency;
      if (form.frequency === 'CUSTOM')  payload.customIntervalDays = Number(form.customIntervalDays);
      if (form.frequency === 'WEEKLY')  payload.sendDayOfWeek  = Number(form.sendDayOfWeek);
      if (form.frequency === 'MONTHLY') payload.sendDayOfMonth = Number(form.sendDayOfMonth);
      if (form.endType && form.endType !== 'MANUAL') {
        payload.endType = form.endType as EndType;
        if (form.endType === 'AFTER_N')    payload.endAfterCount = Number(form.endAfterCount);
        if (form.endType === 'UNTIL_DATE') payload.endDate = form.endDate;
      } else if (form.endType === 'MANUAL') {
        payload.endType = 'MANUAL' as EndType;
      }
    }

    try {
      await createScheduledReport(payload);
      setSaveState('done');
      setTimeout(() => {
        setSaveState('idle');
        resetAndClose();
      }, 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 4000);
    }
  }, [form, projectId, saveState]);

  const resetAndClose = () => {
    setStep(1);
    setForm(EMPTY_FORM);
    setErrors({});
    setSaveState('idle');
    onClose();
  };

  // ── Derived summary strings ────────────────────────────────────────────────

  const formatLabel  =
    form.format === 'PDF' ? 'PDF Report' :
    form.format === 'EXCEL' ? 'Excel Workbook' :
    form.format === 'BOTH' ? 'PDF + Excel' : '—';

  const freqLabel = (() => {
    if (form.scheduleType === 'ONE_TIME') return `One-time on ${form.scheduledDate || '—'}`;
    switch (form.frequency) {
      case 'DAILY':   return `Every day at ${form.sendTime}`;
      case 'WEEKLY':  return `Every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][Number(form.sendDayOfWeek)] ?? '—'} at ${form.sendTime}`;
      case 'MONTHLY': return `Day ${form.sendDayOfMonth} of each month at ${form.sendTime}`;
      case 'CUSTOM':  return `Every ${form.customIntervalDays} day(s) at ${form.sendTime}`;
      default:        return '—';
    }
  })();

  const endLabel = (() => {
    if (form.scheduleType === 'ONE_TIME') return 'N/A';
    switch (form.endType) {
      case 'AFTER_N':    return `After ${form.endAfterCount} send(s)`;
      case 'UNTIL_DATE': return `Until ${form.endDate || '—'}`;
      case 'MANUAL':     return 'Until manually stopped';
      default:           return '—';
    }
  })();

  // ── Step content ──────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Step 1: Schedule type ──────────────────────────────────────────────
      case 1: return (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[13px] font-bold text-[#1F2937] mb-1">How would you like to schedule this report?</p>
            <p className="text-[11px] text-[#9CA3AF]">Choose whether to send once or on a repeating schedule.</p>
          </div>
          <SegControl
            value={form.scheduleType}
            onChange={v => set('scheduleType', v)}
            options={[
              { value: 'ONE_TIME',   label: 'One-Time',      desc: 'Send the report once at a specific date & time', Icon: Calendar },
              { value: 'RECURRING', label: 'Recurring',      desc: 'Send on a repeating schedule (daily, weekly, etc.)', Icon: RefreshCw },
            ]}
          />
          {errors.scheduleType && <p className="text-[11px] text-red-500">{errors.scheduleType}</p>}
        </div>
      );

      // ── Step 2: Format + Timing ────────────────────────────────────────────
      case 2: return (
        <div className="flex flex-col gap-5">
          {/* Format */}
          <div>
            <FieldLabel>Report Format</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {([ ['PDF','FileText','#DC2626','#FFF5F5'], ['EXCEL','Table2','#16A34A','#F0FDF4'], ['BOTH','Sparkles','#155DFC','#EBF2FF'] ] as const).map(
                ([id, , color, bg]) => {
                  const sel = form.format === id;
                  const Icon = { PDF: FileText, EXCEL: Table2, BOTH: Sparkles }[id];
                  return (
                    <button key={id} type="button" onClick={() => set('format', id)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center cursor-pointer transition-all"
                      style={{ borderColor: sel ? color : '#E5E7EB', background: sel ? bg : '#FAFAFA' }}
                    >
                      <Icon size={18} style={{ color }} />
                      <span className="text-[11px] font-bold" style={{ color: sel ? color : '#374151' }}>{id === 'BOTH' ? 'Both' : id}</span>
                    </button>
                  );
                }
              )}
            </div>
            {errors.format && <p className="text-[11px] text-red-500 mt-1">{errors.format}</p>}
          </div>

          {/* One-Time: Date */}
          {form.scheduleType === 'ONE_TIME' && (
            <div>
              <FieldLabel>Send Date</FieldLabel>
              <TextInput type="date" value={form.scheduledDate} onChange={v => set('scheduledDate', v)} />
              {errors.scheduledDate && <p className="text-[11px] text-red-500 mt-1">{errors.scheduledDate}</p>}
            </div>
          )}

          {/* Recurring: Frequency */}
          {form.scheduleType === 'RECURRING' && (
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel>Frequency</FieldLabel>
                <SelectInput value={form.frequency} onChange={v => set('frequency', v as Frequency)}>
                  <option value="">Select frequency…</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="CUSTOM">Custom interval</option>
                </SelectInput>
                {errors.frequency && <p className="text-[11px] text-red-500 mt-1">{errors.frequency}</p>}
              </div>

              {form.frequency === 'CUSTOM' && (
                <div>
                  <FieldLabel>Every how many days?</FieldLabel>
                  <TextInput type="number" value={form.customIntervalDays}
                    onChange={v => set('customIntervalDays', v)} placeholder="e.g. 3" />
                  {errors.customIntervalDays && <p className="text-[11px] text-red-500 mt-1">{errors.customIntervalDays}</p>}
                </div>
              )}

              {form.frequency === 'WEEKLY' && (
                <div>
                  <FieldLabel>Day of week</FieldLabel>
                  <SelectInput value={form.sendDayOfWeek} onChange={v => set('sendDayOfWeek', v)}>
                    {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i) =>
                      <option key={i} value={i}>{d}</option>
                    )}
                  </SelectInput>
                </div>
              )}

              {form.frequency === 'MONTHLY' && (
                <div>
                  <FieldLabel>Day of month</FieldLabel>
                  <SelectInput value={form.sendDayOfMonth} onChange={v => set('sendDayOfMonth', v)}>
                    {Array.from({ length: 28 }, (_, i) =>
                      <option key={i+1} value={i+1}>{i+1}</option>
                    )}
                  </SelectInput>
                </div>
              )}
            </div>
          )}

          {/* Time of day */}
          <div>
            <FieldLabel>Time of Day (UTC)</FieldLabel>
            <TextInput type="time" value={form.sendTime} onChange={v => set('sendTime', v)} />
            {errors.sendTime && <p className="text-[11px] text-red-500 mt-1">{errors.sendTime}</p>}
          </div>
        </div>
      );

      // ── Step 3: Recipients ─────────────────────────────────────────────────
      case 3: return (
        <div className="flex flex-col gap-4">
          <EmailChipInput
            label="To" required
            value={form.recipientsTo}
            onChange={v => set('recipientsTo', v)}
            error={errors.recipientsTo}
            placeholder="recipient@email.com"
          />
          <EmailChipInput
            label="CC"
            value={form.recipientsCc}
            onChange={v => set('recipientsCc', v)}
            placeholder="cc@email.com"
          />
          <EmailChipInput
            label="BCC"
            value={form.recipientsBcc}
            onChange={v => set('recipientsBcc', v)}
            placeholder="bcc@email.com"
          />
        </div>
      );

      // ── Step 4 (Message) or End Condition for recurring ────────────────────
      case 4:
        if (form.scheduleType === 'RECURRING') {
          // End condition step
          return (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[13px] font-bold text-[#1F2937] mb-1">When should the recurring schedule stop?</p>
                <p className="text-[11px] text-[#9CA3AF]">Configure the end condition for your repeating report.</p>
              </div>
              <SegControl
                value={form.endType}
                onChange={v => set('endType', v as EndType)}
                options={[
                  { value: 'AFTER_N',    label: 'After N sends',       desc: 'Stop after a fixed number of deliveries', Icon: RefreshCw },
                  { value: 'UNTIL_DATE', label: 'Until a date',        desc: 'Stop sending after a specific end date',  Icon: Calendar  },
                  { value: 'MANUAL',     label: 'Until manually stopped', desc: 'Continue until you pause or cancel it', Icon: CalendarClock },
                ]}
              />
              {errors.endType && <p className="text-[11px] text-red-500">{errors.endType}</p>}

              {form.endType === 'AFTER_N' && (
                <div>
                  <FieldLabel>Number of sends</FieldLabel>
                  <TextInput type="number" value={form.endAfterCount} onChange={v => set('endAfterCount', v)} placeholder="e.g. 10" />
                  {errors.endAfterCount && <p className="text-[11px] text-red-500 mt-1">{errors.endAfterCount}</p>}
                </div>
              )}
              {form.endType === 'UNTIL_DATE' && (
                <div>
                  <FieldLabel>End Date</FieldLabel>
                  <TextInput type="date" value={form.endDate} onChange={v => set('endDate', v)} />
                  {errors.endDate && <p className="text-[11px] text-red-500 mt-1">{errors.endDate}</p>}
                </div>
              )}
            </div>
          );
        }
        // One-time → Message step
        return renderMessageStep();

      // ── Step 5: Message (recurring) / Summary (one-time) ──────────────────
      case 5:
        if (form.scheduleType === 'RECURRING') return renderMessageStep();
        return renderSummary();

      // ── Step 6: Summary (recurring) ────────────────────────────────────────
      case 6: return renderSummary();

      default: return null;
    }
  };

  function renderMessageStep() {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <FieldLabel>Subject (optional)</FieldLabel>
          <TextInput
            value={form.subject}
            onChange={v => set('subject', v)}
            placeholder={`Report for ${projectName}`}
          />
        </div>
        <div>
          <FieldLabel>Message / Body (optional)</FieldLabel>
          <textarea
            value={form.bodyMessage}
            onChange={e => set('bodyMessage', e.target.value)}
            placeholder="Add a personal note to the email…"
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white/80 text-[12px] text-[#1F2937] outline-none
                       focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/10 transition-all resize-none"
            style={{ fontSize: '12px' }}
          />
        </div>
      </div>
    );
  }

  function renderSummary() {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-bold text-[#1F2937] mb-1">Review your schedule</p>
        <div
          className="rounded-xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(21,93,252,0.05) 0%, rgba(77,139,255,0.04) 100%)',
            border: '1px solid rgba(21,93,252,0.12)',
          }}
        >
          <SummaryRow label="Format"    value={formatLabel} />
          <SummaryRow label="Type"      value={form.scheduleType === 'ONE_TIME' ? 'One-Time' : 'Recurring'} />
          <SummaryRow label="Schedule"  value={freqLabel} />
          {form.scheduleType === 'RECURRING' && <SummaryRow label="Ends" value={endLabel} />}
          <SummaryRow label="To"        value={form.recipientsTo.join(', ')} />
          {form.recipientsCc.length  > 0 && <SummaryRow label="CC"  value={form.recipientsCc.join(', ')}  />}
          {form.recipientsBcc.length > 0 && <SummaryRow label="BCC" value={form.recipientsBcc.join(', ')} />}
          {form.subject      && <SummaryRow label="Subject" value={form.subject} />}
          {form.bodyMessage  && <SummaryRow label="Message" value={form.bodyMessage.slice(0, 80) + (form.bodyMessage.length > 80 ? '…' : '')} />}
        </div>
        <p className="text-[11px] text-[#9CA3AF] text-center mt-1">
          Confirm to activate this schedule. You can pause or cancel it anytime from the Report page.
        </p>
      </div>
    );
  }

  // ── Step labels ───────────────────────────────────────────────────────────────
  const stepLabels =
    form.scheduleType === 'RECURRING'
      ? ['Type', 'Timing', 'To', 'Ends', 'Message', 'Review']
      : ['Type', 'Timing', 'To', 'Message', 'Review'];

  const isFinalStep = step === totalSteps;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => { if (saveState !== 'loading') resetAndClose(); }}
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
              className="pointer-events-auto w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: 'rgba(255,255,255,0.93)',
                backdropFilter: 'blur(24px) saturate(210%)',
                border: '1px solid rgba(255,255,255,0.65)',
              }}
            >
              {/* Header */}
              <div
                className="px-6 py-5 flex items-center justify-between shrink-0"
                style={{ background: 'linear-gradient(135deg,#155DFC 0%,#4D8BFF 100%)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <CalendarClock size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-black text-white leading-tight">Schedule Report</h2>
                    <p className="text-[11px] text-white/70 mt-0.5">{projectName}</p>
                  </div>
                </div>
                <button
                  onClick={() => { if (saveState !== 'loading') resetAndClose(); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/15 hover:bg-white/25 text-white transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Step indicators */}
              <div className="px-6 pt-4 pb-3 flex items-center justify-between gap-2 shrink-0 border-b border-[#F3F4F6]">
                {stepLabels.map((label, i) => (
                  <React.Fragment key={label}>
                    <StepDot n={i + 1} current={step} label={label} />
                    {i < stepLabels.length - 1 && (
                      <div className="flex-1 h-px" style={{
                        background: i + 1 < step ? '#16A34A' : '#E5E7EB',
                      }} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Body (scrollable) */}
              <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.18 }}
                  >
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[#F3F4F6] flex items-center justify-between gap-3 shrink-0">
                <button
                  onClick={back}
                  disabled={step === 1 || saveState === 'loading'}
                  className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-[12px] font-semibold text-[#6B7280]
                             hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>

                <div className="flex items-center gap-1.5">
                  {stepLabels.map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{ background: i + 1 === step ? '#155DFC' : '#E5E7EB' }}
                    />
                  ))}
                </div>

                {isFinalStep ? (
                  <motion.button
                    onClick={handleConfirm}
                    disabled={saveState === 'loading' || saveState === 'done'}
                    whileHover={{ scale: saveState === 'idle' ? 1.02 : 1 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-1.5 px-5 h-9 rounded-xl text-[12px] font-bold text-white transition-all disabled:cursor-not-allowed"
                    style={{
                      background: saveState === 'done'
                        ? 'linear-gradient(135deg,#16A34A,#22C55E)'
                        : saveState === 'error'
                          ? 'linear-gradient(135deg,#DC2626,#EF4444)'
                          : 'linear-gradient(135deg,#155DFC,#4D8BFF)',
                      boxShadow: '0 4px 16px rgba(21,93,252,0.30)',
                    }}
                  >
                    {saveState === 'loading' ? <><Loader2 size={13} className="animate-spin" /> Scheduling…</> :
                     saveState === 'done'    ? <><CheckCircle2 size={13} /> Scheduled!</> :
                     saveState === 'error'   ? <><AlertTriangle size={13} /> Failed — Retry</> :
                     <>Confirm Schedule <CheckCircle2 size={13} /></>}
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={next}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-1.5 px-5 h-9 rounded-xl text-[12px] font-bold text-white"
                    style={{
                      background: 'linear-gradient(135deg,#155DFC,#4D8BFF)',
                      boxShadow: '0 4px 16px rgba(21,93,252,0.25)',
                    }}
                  >
                    Next <ChevronRight size={14} />
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface NotificationStatsProps {
  total: number;
  unread: number;
  read: number;
}

export function NotificationStats({ total, unread, read }: NotificationStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
      <div className="rounded-2xl border border-slate-100 bg-white px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-outfit">Total</p>
        <p className="text-2xl font-bold text-[#101828] mt-1 font-outfit">{total}</p>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-outfit">Unread</p>
        <p className="text-2xl font-bold text-blue-600 mt-1 font-outfit">{unread}</p>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-outfit">Read</p>
        <p className="text-2xl font-bold text-slate-600 mt-1 font-outfit">{read}</p>
      </div>
    </div>
  );
}

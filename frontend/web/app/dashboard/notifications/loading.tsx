export default function DashboardNotificationsLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto pb-8 sm:pb-10 space-y-5 sm:space-y-6">
      <div className="animate-pulse space-y-3">
        <div className="h-9 w-56 rounded bg-slate-100" />
        <div className="h-4 w-80 rounded bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm animate-pulse">
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="h-8 w-16 rounded bg-slate-100 mt-2" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden animate-pulse">
        <div className="h-16 border-b border-slate-100 bg-slate-50" />
        <div className="h-24 border-b border-slate-50" />
        <div className="h-24 border-b border-slate-50" />
        <div className="h-24" />
      </div>
    </div>
  );
}

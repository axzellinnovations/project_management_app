export default function InboxLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col gap-3">
      {[1, 2, 3].map((row) => (
        <div key={row} className="bg-white border border-slate-200 rounded-2xl p-4 animate-pulse">
          <div className="h-4 w-48 bg-slate-200 rounded" />
          <div className="h-3 w-32 bg-slate-100 rounded mt-2" />
          <div className="h-12 w-full bg-slate-100 rounded-xl mt-4" />
        </div>
      ))}
    </div>
  );
}

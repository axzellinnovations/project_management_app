export default function MembersLoading() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="h-8 w-52 bg-slate-200 rounded animate-pulse" />
      <div className="h-4 w-72 bg-slate-100 rounded mt-3 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        {[1, 2, 3, 4].map((card) => (
          <div key={card} className="bg-white rounded-xl shadow p-4 animate-pulse">
            <div className="h-3 w-20 bg-slate-200 rounded" />
            <div className="h-6 w-14 bg-slate-300 rounded mt-3" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow mt-6 p-4 animate-pulse">
        <div className="h-10 w-full bg-slate-100 rounded" />
        <div className="h-72 w-full bg-slate-50 rounded mt-4" />
      </div>
    </div>
  );
}

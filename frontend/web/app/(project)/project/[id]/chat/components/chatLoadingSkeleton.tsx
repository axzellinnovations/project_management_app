export function ChatLoadingSkeleton() {
  return (
    <div className="flex bg-[#F7F8FA] h-full min-h-0">
      <div className="w-72 h-full bg-white border-r border-gray-100 flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-100 animate-pulse" />
            <div className="h-4 w-24 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="px-3 pt-3">
          <div className="h-9 bg-gray-100 rounded-xl animate-pulse" />
        </div>
        <div className="flex-1 px-3 mt-4 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className={`h-3 bg-gray-100 rounded animate-pulse ${i % 3 === 0 ? 'w-3/4' : i % 3 === 1 ? 'w-1/2' : 'w-2/3'}`} />
                <div className="h-2.5 bg-gray-100 rounded animate-pulse w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b border-gray-100 bg-white px-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 bg-gray-100 rounded animate-pulse" />
            <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 px-6 py-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
              <div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
              <div className={`h-12 bg-gray-100 animate-pulse rounded-2xl ${i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-64' : 'w-40'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

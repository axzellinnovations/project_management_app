'use client';

interface BurndownStatsGridProps {
  totalStoryPoints: number;
  donePoints: number;
  remainingPoints: number;
  progressPct: number;
}

export default function BurndownStatsGrid({
  totalStoryPoints,
  donePoints,
  remainingPoints,
  progressPct,
}: BurndownStatsGridProps) {
  const stats = [
    {
      label: 'Total Points',
      value: totalStoryPoints,
      sub: 'in sprint',
      color: 'text-[#101828]',
    },
    {
      label: 'Completed',
      value: donePoints,
      sub: 'story points',
      color: 'text-[#027A48]',
    },
    {
      label: 'Remaining',
      value: remainingPoints,
      sub: 'story points',
      color: 'text-[#175CD3]',
    },
    {
      label: 'Progress',
      value: `${progressPct}%`,
      sub: 'completed',
      color: progressPct >= 80 ? 'text-[#027A48]' : progressPct >= 50 ? 'text-[#B54708]' : 'text-[#F04438]',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="group rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-[#D0D5DD]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3] transition-colors group-hover:text-[#667085]">{stat.label}</p>
          <p className={`mt-1 text-[22px] font-bold leading-tight transition-transform duration-300 group-hover:scale-105 origin-left ${stat.color}`}>{stat.value}</p>
          <p className="text-[11px] text-[#667085] transition-opacity duration-300 group-hover:opacity-80">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}

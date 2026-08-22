/**
 * Signature dashboard element: a horizontal strip of period "pills" that
 * gives the coordinator an at-a-glance read of the whole day's coverage
 * before they even look at the table below — assigned, unassigned, or
 * not-yet-generated, per period.
 */
export default function CoverageStrip({ periods, entries }) {
  const statusForPeriod = (periodNum) => {
    const periodEntries = entries.filter((e) => e.period === periodNum)
    if (periodEntries.length === 0) return 'idle'
    if (periodEntries.some((e) => e.status === 'Unassigned')) return 'gap'
    return 'covered'
  }

  const styles = {
    idle: 'bg-slate-100 text-slate-400 border-slate-200',
    covered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    gap: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  return (
    <div className="flex flex-wrap gap-2">
      {periods.map((p) => (
        <div
          key={p.period}
          className={`flex min-w-[76px] flex-col items-center gap-0.5 rounded-xl border px-3 py-2 ${styles[statusForPeriod(p.period)]}`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide">P{p.period}</span>
          <span className="font-mono text-[10.5px] opacity-80">{p.time}</span>
        </div>
      ))}
    </div>
  )
}

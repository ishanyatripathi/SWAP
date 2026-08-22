export default function StatCard({ label, value, sublabel, tone = 'default' }) {
  const toneClasses = {
    default: 'text-slate-900',
    warn: 'text-amber-600',
    good: 'text-emerald-600',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold tracking-tight ${toneClasses[tone]}`}>
        {value}
      </p>
      {sublabel && <p className="mt-1 text-[12.5px] text-slate-400">{sublabel}</p>}
    </div>
  )
}

/**
 * The manual-review step: one row per lecture that needs a substitute,
 * each with a dropdown of every teacher free at that period. Pre-filled
 * with the suggested (first-free) pick, but the coordinator can change
 * any of them — a "free" teacher on paper might have exam duty, a
 * meeting, or other work the timetable doesn't capture.
 *
 * Cross-row guard: a teacher already picked for another lecture in the
 * SAME period is hidden from that period's other dropdowns, so the
 * coordinator can't accidentally double-book one substitute across two
 * simultaneous classes.
 */
export default function CoverageReviewTable({ options, assignments, onAssign }) {
  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-16 text-center">
        <p className="text-[14px] font-medium text-slate-500">No lectures need coverage.</p>
        <p className="mt-1 text-[13px] text-slate-400">
          Mark today's absent teachers above and click Generate Substitution.
        </p>
      </div>
    )
  }

  const keyOf = (o) => `${o.period}|${o.class_name}|${o.absent_teacher}`

  const takenInPeriod = (period, exceptKey) =>
    new Set(
      options
        .filter((o) => o.period === period && keyOf(o) !== exceptKey)
        .map((o) => assignments[keyOf(o)])
        .filter(Boolean)
    )

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <table className="w-full text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3">Period</th>
            <th className="px-5 py-3">Time</th>
            <th className="px-5 py-3">Class</th>
            <th className="px-5 py-3">Subject</th>
            <th className="px-5 py-3">Absent Teacher</th>
            <th className="px-5 py-3">Substitute</th>
            <th className="px-5 py-3">Room</th>
            <th className="px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {options.map((o) => {
            const key = keyOf(o)
            const current = assignments[key] ?? o.suggested_substitute ?? ''
            const taken = takenInPeriod(o.period, key)
            const isOverridden = o.suggested_substitute && current && current !== o.suggested_substitute

            return (
              <tr key={key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3 font-mono text-slate-600">P{o.period}</td>
                <td className="px-5 py-3 font-mono text-slate-500">{o.time_slot || '—'}</td>
                <td className="px-5 py-3 font-medium text-slate-800">{o.class_name}</td>
                <td className="px-5 py-3 text-slate-600">{o.subject || '—'}</td>
                <td className="px-5 py-3 text-slate-600">{o.absent_teacher}</td>
                <td className="px-5 py-3">
                  <select
                    value={current}
                    onChange={(e) => onAssign(key, e.target.value || null)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[13px] ${
                      isOverridden ? 'border-blue-300 bg-blue-50 text-blue-800 font-medium' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <option value="">— Unassigned —</option>
                    {o.free_teachers
                      .filter((name) => name === current || !taken.has(name))
                      .map((name) => (
                        <option key={name} value={name}>
                          {name}
                          {name === o.suggested_substitute ? ' (suggested)' : ''}
                        </option>
                      ))}
                  </select>
                  {o.free_teachers.length === 0 && (
                    <p className="mt-1 text-[11.5px] text-amber-600">No teachers free this period.</p>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-500">{o.room || '—'}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11.5px] font-medium ${
                      current ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {current ? 'Assigned' : 'Unassigned'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function SubstitutionTable({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-16 text-center">
        <p className="text-[14px] font-medium text-slate-500">No substitutions generated yet.</p>
        <p className="mt-1 text-[13px] text-slate-400">
          Mark today's absent teachers above and click Generate Substitution.
        </p>
      </div>
    )
  }

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
          {entries.map((e, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
              <td className="px-5 py-3 font-mono text-slate-600">P{e.period}</td>
              <td className="px-5 py-3 font-mono text-slate-500">{e.time_slot || '—'}</td>
              <td className="px-5 py-3 font-medium text-slate-800">{e.class_name}</td>
              <td className="px-5 py-3 text-slate-600">{e.subject || '—'}</td>
              <td className="px-5 py-3 text-slate-600">{e.absent_teacher}</td>
              <td className="px-5 py-3 font-medium text-slate-800">
                {e.substitute_teacher || <span className="text-slate-400">Unassigned</span>}
              </td>
              <td className="px-5 py-3 text-slate-500">{e.room || '—'}</td>
              <td className="px-5 py-3">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11.5px] font-medium ${
                    e.status === 'Assigned'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {e.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import SubstitutionTable from '../components/SubstitutionTable'
import PrintableSubstitutionSheet from '../components/PrintableSubstitutionSheet'

export default function History() {
  const [runs, setRuns] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState(null)

  const load = () => api.listRuns(dateFrom || undefined, dateTo || undefined).then(setRuns).catch(() => {})
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-slate-900">History</h1>
      <p className="mt-1 text-[13.5px] text-slate-500">Every past substitution run, filterable by date.</p>

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <label className="text-[13px] text-slate-600">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-1.5 text-[13px]"
          />
        </label>
        <label className="text-[13px] text-slate-600">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-1.5 text-[13px]"
          />
        </label>
        <button
          onClick={load}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
        >
          Filter
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        <div className="divide-y divide-slate-100 self-start rounded-2xl border border-slate-200 bg-white shadow-soft">
          {runs.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-slate-400">No runs found.</p>}
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelected(run)}
              className={`block w-full px-4 py-3 text-left transition ${
                selected?.id === run.id ? 'bg-brand-50' : 'hover:bg-slate-50'
              }`}
            >
              <p className="text-[13.5px] font-medium text-slate-800">{run.date}</p>
              <p className="mt-0.5 text-[12px] text-slate-400">
                {run.absent_teacher_names.length} absent · {run.entries.length} lectures
              </p>
            </button>
          ))}
        </div>

        <div>
          {selected ? (
            <>
              <div className="mb-3 flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Print substitution sheet
                </button>
              </div>
              <SubstitutionTable entries={selected.entries} />
              <PrintableSubstitutionSheet
                date={selected.date}
                absentTeacherNames={selected.absent_teacher_names}
                entries={selected.entries}
              />
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-16 text-center">
              <p className="text-[13.5px] text-slate-400">Select a date on the left to view its substitution timetable.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

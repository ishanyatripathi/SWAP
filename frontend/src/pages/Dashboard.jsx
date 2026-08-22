import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import StatCard from '../components/StatCard'
import AbsentTeacherSelect from '../components/AbsentTeacherSelect'
import SubstitutionTable from '../components/SubstitutionTable'
import CoverageReviewTable from '../components/CoverageReviewTable'
import CoverageStrip from '../components/CoverageStrip'
import PrintableSubstitutionSheet from '../components/PrintableSubstitutionSheet'

const today = new Date()
const todayLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const todayISO = today.toISOString().slice(0, 10)

const hour = today.getHours()
const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : 'Good evening'

const keyOf = (o) => `${o.period}|${o.class_name}|${o.absent_teacher}`

export default function Dashboard() {
  const [teachers, setTeachers] = useState([])
  const [absent, setAbsent] = useState([])

  // Step 1: preview options (nothing saved yet)
  const [options, setOptions] = useState([])
  const [assignments, setAssignments] = useState({}) // key -> substitute name | null
  const [previewed, setPreviewed] = useState(false)

  // Step 2: confirmed/saved run
  const [confirmedEntries, setConfirmedEntries] = useState([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [recentRuns, setRecentRuns] = useState([])

  useEffect(() => {
    api.getTeachers().then(setTeachers).catch(() => {})
    api.listRuns().then((runs) => setRecentRuns(runs.slice(0, 5))).catch(() => {})
  }, [])

  const handlePreview = async () => {
    setLoading(true)
    setError(null)
    setConfirmedEntries([])
    try {
      const opts = await api.previewSubstitutions(todayISO, absent)
      setOptions(opts)
      const initial = {}
      opts.forEach((o) => { initial[keyOf(o)] = o.suggested_substitute })
      setAssignments(initial)
      setPreviewed(true)
    } catch (e) {
      setError(e.message || 'Could not compute coverage options.')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = (key, value) => {
    setAssignments((prev) => ({ ...prev, [key]: value }))
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    try {
      const entries = options.map((o) => ({
        period: o.period,
        class_name: o.class_name,
        subject: o.subject,
        room: o.room,
        absent_teacher: o.absent_teacher,
        substitute_teacher: assignments[keyOf(o)] || null,
      }))
      const run = await api.confirmSubstitutions(todayISO, absent, entries)
      setConfirmedEntries(run.entries)
      setPreviewed(false)
      setOptions([])
      setRecentRuns((r) => [{ id: run.id, date: run.date, absent_teacher_names: run.absent_teacher_names, entries: run.entries }, ...r].slice(0, 5))
    } catch (e) {
      setError(e.message || 'Could not save the substitution timetable.')
    } finally {
      setSaving(false)
    }
  }

  const handleExportPdf = () => window.print()

  const assignedCount = previewed
    ? options.filter((o) => assignments[keyOf(o)]).length
    : confirmedEntries.filter((e) => e.status === 'Assigned').length
  const totalNeedingCoverage = previewed ? options.length : confirmedEntries.length

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-brand-600">{todayLabel}</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold tracking-tight text-slate-900">
            {greeting}. Let's cover today's classes.
          </h1>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Teachers" value={teachers.length} sublabel="Active faculty on record" />
        <StatCard label="Absent Today" value={absent.length} tone={absent.length ? 'warn' : 'default'} sublabel="Marked in today's roster" />
        <StatCard
          label="Lectures Covered"
          value={totalNeedingCoverage ? `${assignedCount}/${totalNeedingCoverage}` : 0}
          tone={totalNeedingCoverage ? (assignedCount === totalNeedingCoverage ? 'good' : 'warn') : 'default'}
          sublabel={previewed ? 'Reviewing — not saved yet' : confirmedEntries.length ? 'Saved' : 'Not generated yet'}
        />
      </div>

      {(previewed || confirmedEntries.length > 0) && (
        <div className="mt-6">
          <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-slate-400">Today's coverage</p>
          <CoverageStrip
            periods={[...new Set((previewed ? options : confirmedEntries).map((o) => o.period))]
              .sort((a, b) => a - b)
              .map((p) => ({ period: p, time: (previewed ? options : confirmedEntries).find((o) => o.period === p)?.time_slot || '' }))}
            entries={
              previewed
                ? options.map((o) => ({ period: o.period, status: assignments[keyOf(o)] ? 'Assigned' : 'Unassigned' }))
                : confirmedEntries
            }
          />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <p className="text-[13px] font-semibold text-slate-700">Mark absent teachers</p>
        <div className="mt-3">
          <AbsentTeacherSelect teachers={teachers} selected={absent} onChange={setAbsent} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={absent.length === 0 || loading}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {loading ? 'Finding free teachers…' : 'Generate Substitution'}
          </button>

          {previewed && (
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-soft transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Confirm & Save'}
            </button>
          )}

          {confirmedEntries.length > 0 && (
            <>
              <button onClick={handleExportPdf} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] font-medium text-slate-600 hover:bg-slate-50">
                Export as PDF
              </button>
              <button onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] font-medium text-slate-600 hover:bg-slate-50">
                Print
              </button>
            </>
          )}
        </div>
        {previewed && (
          <p className="mt-3 text-[12.5px] text-slate-400">
            Suggested substitutes are pre-filled — the free-teacher list may not account for exam duty, meetings, or other
            work, so review each row before saving. Click <span className="font-medium text-slate-600">Confirm & Save</span> once it looks right.
          </p>
        )}
        {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
      </div>

      <div className="mt-8">
        <p className="mb-3 text-[13px] font-semibold text-slate-700">
          {previewed ? 'Review & assign substitutes' : 'Substitution timetable'}
        </p>
        {previewed ? (
          <CoverageReviewTable options={options} assignments={assignments} onAssign={handleAssign} />
        ) : (
          <SubstitutionTable entries={confirmedEntries} />
        )}
      </div>

      {recentRuns.length > 0 && (
        <div className="mt-10">
          <p className="mb-3 text-[13px] font-semibold text-slate-700">Recent substitutions</p>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-soft">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-[13.5px] font-medium text-slate-800">{run.date}</p>
                  <p className="text-[12.5px] text-slate-400">
                    {run.absent_teacher_names.join(', ') || 'No absences'}
                  </p>
                </div>
                <span className="text-[12.5px] text-slate-400">{run.entries.length} lectures covered</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmedEntries.length > 0 && (
        <PrintableSubstitutionSheet
          date={todayISO}
          absentTeacherNames={absent}
          entries={confirmedEntries}
        />
      )}
    </div>
  )
}

import { useEffect, useState, useMemo } from 'react'
import { api } from '../lib/api'

// ─── Constants ────────────────────────────────────────────────────────────────
const JS_DAY_TO_CODE = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const WORKING_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_LABEL = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday',
  THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday',
}
const DAY_SHORT = {
  MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat',
}

// ICSE period time slots (12 periods)
const PERIODS = [
  { period: 1,  label: 'P1',  time: '8:45–9:15 AM',   start: '08:45', end: '09:15' },
  { period: 2,  label: 'P2',  time: '9:15–9:45 AM',   start: '09:15', end: '09:45' },
  // Short break 9:45–10:00
  { period: 3,  label: 'P3',  time: '10:00–10:30 AM', start: '10:00', end: '10:30' },
  { period: 4,  label: 'P4',  time: '10:30–11:00 AM', start: '10:30', end: '11:00' },
  { period: 5,  label: 'P5',  time: '11:00–11:30 AM', start: '11:00', end: '11:30' },
  { period: 6,  label: 'P6',  time: '11:30–12:00 PM', start: '11:30', end: '12:00' },
  { period: 7,  label: 'P7',  time: '12:00–12:30 PM', start: '12:00', end: '12:30' },
  // Long break 12:30–13:05
  { period: 8,  label: 'P8',  time: '1:05–1:35 PM',   start: '13:05', end: '13:35' },
  { period: 9,  label: 'P9',  time: '1:35–2:05 PM',   start: '13:35', end: '14:05' },
  { period: 10, label: 'P10', time: '2:05–2:35 PM',   start: '14:05', end: '14:35' },
  // Short break 14:35–14:45
  { period: 11, label: 'P11', time: '2:45–3:15 PM',   start: '14:45', end: '15:15' },
  { period: 12, label: 'P12', time: '3:15–3:45 PM',   start: '15:15', end: '15:45' },
]

// Breaks to render between period columns in the grid
const BREAKS_AFTER = {
  2:  { label: '☕ Break',  short: '9:45–10:00' },
  7:  { label: '🍽️ Lunch', short: '12:30–1:05' },
  10: { label: '🙏 Prayer', short: '2:35–2:45'  },
}

function todayCode() {
  const code = JS_DAY_TO_CODE[new Date().getDay()]
  return WORKING_DAYS.includes(code) ? code : 'MON'
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [show, setShow] = useState(false)
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && text && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11.5px] text-white shadow-lg pointer-events-none">
          {text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  )
}

// ─── Heatmap Cell ─────────────────────────────────────────────────────────────
function HeatCell({ isFree, teacherName, periodLabel, timeSlot }) {
  const tip = isFree
    ? `${teacherName} — FREE at ${periodLabel} (${timeSlot})`
    : `${teacherName} — Busy at ${periodLabel}`

  return (
    <Tooltip text={tip}>
      <div
        className={`h-6 w-6 rounded-sm cursor-default transition-all duration-100 ${
          isFree
            ? 'bg-emerald-400 hover:bg-emerald-500 ring-1 ring-emerald-300'
            : 'bg-slate-150 hover:bg-slate-200'
        }`}
        style={!isFree ? { backgroundColor: '#e9edf2' } : {}}
      />
    </Tooltip>
  )
}

// ─── Period Column Header ──────────────────────────────────────────────────────
function PeriodHeader({ p, freeCount, totalTeachers }) {
  const pct = totalTeachers > 0 ? freeCount / totalTeachers : 0
  const barColor = pct >= 0.5 ? 'bg-emerald-400' : pct >= 0.25 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="flex flex-col items-center gap-1 px-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{p.label}</span>
      <span className="text-[9px] text-slate-400 leading-tight text-center whitespace-nowrap hidden sm:block">
        {p.time.split('–')[0].trim()}
      </span>
      {/* mini bar showing % free */}
      <div className="h-1 w-6 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <span className="text-[9.5px] font-semibold text-slate-500">{freeCount}</span>
    </div>
  )
}

// ─── Period Detail Card (period-wise panel) ───────────────────────────────────
function PeriodDetailCard({ p, freeTeachers, busyCount }) {
  const [open, setOpen] = useState(false)
  const pct = (freeTeachers.length + busyCount) > 0
    ? freeTeachers.length / (freeTeachers.length + busyCount)
    : 0
  const tone = pct >= 0.5 ? 'emerald' : pct >= 0.25 ? 'amber' : 'red'
  const toneCls = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber:   'border-amber-200   bg-amber-50   text-amber-700',
    red:     'border-red-200     bg-red-50     text-red-700',
  }[tone]

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <span className="text-[12px] font-bold">{p.label}</span>
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-slate-800">Period {p.period}</p>
            <p className="text-[12px] text-slate-400">{p.time}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold border ${toneCls}`}>
            {freeTeachers.length} free
          </span>
          <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          {freeTeachers.length === 0 ? (
            <p className="text-[12.5px] text-slate-400 italic">No teachers free this period.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {freeTeachers.map(name => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700"
                >
                  <span className="h-5 w-5 rounded-full bg-emerald-50 flex items-center justify-center text-[10px] font-bold text-emerald-600">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FreeWindows() {
  const [day, setDay]       = useState(todayCode())
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView]     = useState('heatmap') // 'heatmap' | 'period'
  const [minFree, setMinFree] = useState(0)        // filter: show teachers with >= N free periods

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    api.getAvailability(day)
      .then(setData)
      .catch(e => setError(e.message || 'Could not load data.'))
      .finally(() => setLoading(false))
  }, [day])

  // Build lookup: teacherName → Set of free periods
  const freeMap = useMemo(() => {
    if (!data) return {}
    const map = {}
    for (const t of data.teacher_wise ?? []) {
      map[t.teacher_name] = new Set((t.free_periods ?? []).map(fp => fp.period))
    }
    return map
  }, [data])

  // Per-period free-teacher lists (from period_wise)
  const periodFreeMap = useMemo(() => {
    if (!data) return {}
    const map = {}
    for (const pw of data.period_wise ?? []) {
      map[pw.period] = pw.free_teachers ?? []
    }
    return map
  }, [data])

  // Filtered + sorted teacher list
  const teachers = useMemo(() => {
    if (!data) return []
    let list = data.teacher_wise ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(t => t.teacher_name.toLowerCase().includes(q))
    }
    if (minFree > 0) {
      list = list.filter(t => t.total_free_periods >= minFree)
    }
    return [...list].sort((a, b) => b.total_free_periods - a.total_free_periods)
  }, [data, search, minFree])

  // Summary numbers
  const totalTeachers = data?.teacher_wise?.length ?? 0
  const totalFreeSlots = data?.teacher_wise?.reduce((s, t) => s + t.total_free_periods, 0) ?? 0
  const peakPeriod = PERIODS.reduce((best, p) => {
    const cnt = (periodFreeMap[p.period] ?? []).length
    return cnt > (periodFreeMap[best?.period ?? -1] ?? []).length ? p : best
  }, null)
  const peakCount = peakPeriod ? (periodFreeMap[peakPeriod.period] ?? []).length : 0

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-brand-600">Free Windows</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold tracking-tight text-slate-900">
            Teacher Availability — {DAY_LABEL[day]}
          </h1>
          <p className="mt-1 text-[13px] text-slate-400">
            See exactly which teachers are free, period by period.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-colors"
        >
          🖨️ Print
        </button>
      </div>

      {/* ── Day Selector ── */}
      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        {WORKING_DAYS.map(d => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors ${
              day === d
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="hidden sm:inline">{DAY_LABEL[d]}</span>
            <span className="sm:hidden">{DAY_SHORT[d]}</span>
          </button>
        ))}
      </div>

      {/* ── Summary Cards ── */}
      {data && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Faculty</p>
            <p className="mt-1 text-[28px] font-bold text-slate-900">{totalTeachers}</p>
            <p className="text-[12px] text-slate-400">teachers today</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Free Slots</p>
            <p className="mt-1 text-[28px] font-bold text-emerald-600">{totalFreeSlots}</p>
            <p className="text-[12px] text-slate-400">total across faculty</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Avg Free</p>
            <p className="mt-1 text-[28px] font-bold text-slate-900">
              {totalTeachers ? (totalFreeSlots / totalTeachers).toFixed(1) : '—'}
            </p>
            <p className="text-[12px] text-slate-400">periods per teacher</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Peak Period</p>
            {peakPeriod ? (
              <>
                <p className="mt-1 text-[28px] font-bold text-brand-700">{peakPeriod.label}</p>
                <p className="text-[12px] text-slate-400">{peakCount} teachers free · {peakPeriod.time}</p>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-slate-400">—</p>
            )}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        {/* View toggle */}
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {[
            { key: 'heatmap', label: '⊞ Heatmap' },
            { key: 'period',  label: '≡ Period List' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                view === key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Min free periods filter (heatmap only) */}
          {view === 'heatmap' && (
            <select
              value={minFree}
              onChange={e => setMinFree(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value={0}>All teachers</option>
              <option value={3}>≥ 3 free periods</option>
              <option value={5}>≥ 5 free periods</option>
              <option value={7}>≥ 7 free periods</option>
            </select>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search teacher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-700 placeholder-slate-400 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 w-52"
          />
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="mt-16 flex flex-col items-center gap-3 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
          <p className="text-[13px]">Loading for {DAY_LABEL[day]}…</p>
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* ── Heatmap View ── */}
      {!loading && !error && data && view === 'heatmap' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

          {/* Legend */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <p className="text-[12px] font-semibold text-slate-500">
              {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} shown
            </p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                <span className="h-3 w-3 rounded-sm bg-emerald-400 inline-block" /> Free
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                <span className="h-3 w-3 rounded-sm inline-block" style={{ backgroundColor: '#e9edf2' }} /> Busy
              </span>
            </div>
          </div>

          {teachers.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-slate-400">No teachers match your filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: '720px' }}>
                <thead>
                  <tr>
                    {/* Teacher name column */}
                    <th className="sticky left-0 z-10 bg-white border-b border-slate-100 px-4 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-400 min-w-[180px]">
                      Teacher
                    </th>
                    {/* Free count column */}
                    <th className="border-b border-slate-100 px-3 py-2 text-center text-[11.5px] font-semibold uppercase tracking-wide text-slate-400 w-12">
                      Free
                    </th>
                    {/* Period columns + break spacers */}
                    {PERIODS.map(p => (
                      <>
                        <th
                          key={p.period}
                          className="border-b border-slate-100 px-1 py-2 text-center w-10"
                        >
                          <PeriodHeader
                            p={p}
                            freeCount={(periodFreeMap[p.period] ?? []).length}
                            totalTeachers={totalTeachers}
                          />
                        </th>
                        {BREAKS_AFTER[p.period] && (
                          <th
                            key={`break-${p.period}`}
                            className="border-b border-slate-100 w-8"
                          >
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className="text-[9px] text-slate-300 leading-none">
                                {BREAKS_AFTER[p.period].label}
                              </span>
                              <span className="text-[8px] text-slate-300 leading-none hidden sm:block">
                                {BREAKS_AFTER[p.period].short}
                              </span>
                            </div>
                          </th>
                        )}
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t, idx) => {
                    const freePeriods = freeMap[t.teacher_name] ?? new Set()
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'

                    return (
                      <tr key={t.teacher_name} className={`${rowBg} hover:bg-brand-50/30 transition-colors`}>
                        {/* Teacher name */}
                        <td className={`sticky left-0 z-10 ${rowBg} border-b border-slate-100 px-4 py-2`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-6 w-6 shrink-0 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-bold text-brand-700">
                              {t.teacher_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[12.5px] font-medium text-slate-700 truncate" title={t.teacher_name}>
                              {t.teacher_name}
                            </span>
                          </div>
                        </td>
                        {/* Free count badge */}
                        <td className="border-b border-slate-100 px-3 py-2 text-center">
                          <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            t.total_free_periods >= 5
                              ? 'bg-emerald-50 text-emerald-700'
                              : t.total_free_periods >= 3
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {t.total_free_periods}
                          </span>
                        </td>
                        {/* Period cells */}
                        {PERIODS.map(p => (
                          <>
                            <td key={p.period} className="border-b border-slate-100 px-1 py-2 text-center">
                              <div className="flex justify-center">
                                <HeatCell
                                  isFree={freePeriods.has(p.period)}
                                  teacherName={t.teacher_name}
                                  periodLabel={p.label}
                                  timeSlot={p.time}
                                />
                              </div>
                            </td>
                            {BREAKS_AFTER[p.period] && (
                              <td key={`break-${p.period}`} className="border-b border-slate-100 px-0 py-2">
                                <div className="h-6 w-full flex items-center justify-center">
                                  <div className="h-4 w-px bg-slate-200" />
                                </div>
                              </td>
                            )}
                          </>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Period List View ── */}
      {!loading && !error && data && view === 'period' && (
        <div className="mt-6 space-y-2">
          {PERIODS.map((p, idx) => {
            const freeTeachers = (periodFreeMap[p.period] ?? []).filter(name =>
              search.trim() === '' || name.toLowerCase().includes(search.trim().toLowerCase())
            )
            const busyCount = totalTeachers - (periodFreeMap[p.period] ?? []).length
            const breakAfter = BREAKS_AFTER[p.period]

            return (
              <div key={p.period}>
                <PeriodDetailCard p={p} freeTeachers={freeTeachers} busyCount={busyCount} />
                {breakAfter && search.trim() === '' && (
                  <div className="my-2 flex items-center justify-center gap-2">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      {breakAfter.label} · {breakAfter.short}
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && !error && !data && (
        <p className="mt-12 text-center text-[13px] text-slate-400">Select a day to view free windows.</p>
      )}
    </div>
  )
}

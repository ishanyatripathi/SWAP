import { useEffect, useState, useMemo } from 'react'
import { api } from '../lib/api'

// ─── Constants & Helpers ──────────────────────────────────────────────────────
const JS_DAY_TO_CODE = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const WORKING_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_LABEL = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday',
  THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday',
}
const DAY_SHORT = {
  MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat',
}

// 12 Standard Periods
const PERIODS = [
  { period: 1,  label: 'P1',  time: '8:45–9:15 AM' },
  { period: 2,  label: 'P2',  time: '9:15–9:45 AM' },
  // Short break 9:45–10:00
  { period: 3,  label: 'P3',  time: '10:00–10:30 AM' },
  { period: 4,  label: 'P4',  time: '10:30–11:00 AM' },
  { period: 5,  label: 'P5',  time: '11:00–11:30 AM' },
  { period: 6,  label: 'P6',  time: '11:30–12:00 PM' },
  { period: 7,  label: 'P7',  time: '12:00–12:30 PM' },
  // Long lunch break 12:30–1:05
  { period: 8,  label: 'P8',  time: '1:05–1:35 PM' },
  { period: 9,  label: 'P9',  time: '1:35–2:05 PM' },
  { period: 10, label: 'P10', time: '2:05–2:35 PM' },
  // Afternoon prayer / break 2:35–2:45
  { period: 11, label: 'P11', time: '2:45–3:15 PM' },
  { period: 12, label: 'P12', time: '3:15–3:45 PM' },
]

const BREAKS_AFTER = {
  2:  { label: '☕ Break',  short: '9:45–10:00' },
  7:  { label: '🍽️ Lunch', short: '12:30–1:05' },
  10: { label: '🙏 Prayer', short: '2:35–2:45'  },
}

function getTodayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

// ─── Heatmap Cell (Green = Free, Gray = Busy, Red = Substitution) ─────────────
function HeatCell({ status, subDuty, teacherName, periodLabel, timeSlot }) {
  // status: 'free' | 'substituted' | 'busy'
  let tip = `${teacherName} — Busy at ${periodLabel}`
  let styleCls = 'bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-400'

  if (status === 'free') {
    tip = `${teacherName} — FREE at ${periodLabel} (${timeSlot})`
    styleCls = 'bg-emerald-500 hover:bg-emerald-600 ring-1 ring-emerald-400 text-white shadow-xs'
  } else if (status === 'substituted') {
    const detail = subDuty 
      ? `Covering ${subDuty.class_name || 'Class'} for ${subDuty.absent_teacher || 'absent'}`
      : 'Substitution Duty'
    tip = `🚨 ${teacherName} — SUBSTITUTION at ${periodLabel}: ${detail} (${timeSlot})`
    styleCls = 'bg-rose-500 hover:bg-rose-600 ring-2 ring-rose-300 text-white shadow-xs animate-pulse'
  }

  return (
    <Tooltip text={tip}>
      <div
        className={`h-6 w-6 rounded-sm flex items-center justify-center cursor-default transition-all duration-100 ${styleCls}`}
      >
        {status === 'substituted' && (
          <span className="text-[9px] font-black leading-none">S</span>
        )}
      </div>
    </Tooltip>
  )
}

// ─── Period Column Header ──────────────────────────────────────────────────────
function PeriodHeader({ p, freeCount, totalTeachers, subCount }) {
  const pct = totalTeachers > 0 ? freeCount / totalTeachers : 0
  const barColor = pct >= 0.5 ? 'bg-emerald-400' : pct >= 0.25 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="flex flex-col items-center gap-1 px-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{p.label}</span>
      <span className="text-[9px] text-slate-400 leading-tight text-center whitespace-nowrap hidden sm:block">
        {p.time.split('–')[0].trim()}
      </span>
      {/* Mini capacity bar */}
      <div className="h-1 w-6 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[9.5px] font-semibold text-slate-600">{freeCount}</span>
        {subCount > 0 && (
          <span className="text-[8.5px] font-bold text-rose-600 bg-rose-50 px-1 rounded-sm" title={`${subCount} substitution(s)`}>
            {subCount}S
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Teacher Card (Expandable Accordion) ───────────────────────────────────────
function TeacherCard({ teacher }) {
  const [open, setOpen] = useState(false)
  const { teacher_name, free_periods = [], total_free_periods = 0, substituted_periods = [] } = teacher

  const tone = total_free_periods >= 4 ? 'good' : total_free_periods >= 2 ? 'default' : 'warn'

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">
            {teacher_name.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-[13.5px] font-medium text-slate-800">{teacher_name}</span>
          {substituted_periods.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
              🚨 {substituted_periods.length} sub duty
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-[12px] text-slate-400">{total_free_periods} free</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
            tone === 'good' ? 'bg-emerald-50 text-emerald-700' : tone === 'default' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'
          }`}>
            {total_free_periods}
          </span>
          <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-3">
          {/* Substituted Periods */}
          {substituted_periods.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-1.5">
                Assigned Substitutions (Red / Busy)
              </p>
              <div className="flex flex-wrap gap-2">
                {substituted_periods.map((sub) => (
                  <span
                    key={sub.period}
                    className="inline-flex flex-col rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 shadow-xs"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wide text-rose-800 flex items-center gap-1">
                      🚨 Period {sub.period} · {sub.class_name}
                    </span>
                    <span className="text-[11px] text-rose-600">
                      Covering for {sub.absent_teacher} {sub.room ? `(${sub.room})` : ''}
                    </span>
                    {sub.time_slot && (
                      <span className="text-[10px] text-rose-400">{sub.time_slot}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Free Periods */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
              Free Periods (Green / Available)
            </p>
            {free_periods.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic">No free periods remaining today.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {free_periods.map((fp) => (
                  <span
                    key={fp.period}
                    className="inline-flex flex-col items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-center"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Period {fp.period}
                    </span>
                    {fp.time_slot ? (
                      <span className="text-[11px] text-emerald-600">{fp.time_slot}</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No time set</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Period Detail Card ───────────────────────────────────────────────────────
function PeriodDetailCard({ p, freeTeachers, subTeachers = [] }) {
  const [open, setOpen] = useState(false)
  const tone = freeTeachers.length >= 5 ? 'emerald' : freeTeachers.length >= 2 ? 'default' : 'warn'

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <span className="text-[13px] font-bold">{p.label}</span>
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-slate-800">Period {p.period}</p>
            <p className="text-[12px] text-slate-400">{p.time}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {subTeachers.length > 0 && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold border border-rose-200 bg-rose-50 text-rose-700">
              🚨 {subTeachers.length} on substitution
            </span>
          )}
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold border ${
            tone === 'emerald'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : tone === 'default'
              ? 'border-slate-200 bg-slate-50 text-slate-600'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}>
            {freeTeachers.length} free
          </span>
          <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
          {/* Teachers on substitution */}
          {subTeachers.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-1.5">
                Assigned to Substitutions This Period (Red / Busy)
              </p>
              <div className="flex flex-wrap gap-2">
                {subTeachers.map((st) => (
                  <span
                    key={st.teacher_name}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[12px] font-medium text-rose-800"
                  >
                    <span className="h-5 w-5 rounded-full bg-rose-200 flex items-center justify-center text-[10px] font-bold text-rose-800">
                      🚨
                    </span>
                    <span>{st.teacher_name}</span>
                    <span className="text-[11px] text-rose-600 font-normal">({st.class_name})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Free teachers */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
              Available Free Teachers (Green)
            </p>
            {freeTeachers.length === 0 ? (
              <p className="text-[12.5px] text-slate-400 italic">No teachers free this period.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {freeTeachers.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 shadow-2xs"
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
        </div>
      )}
    </div>
  )
}

// ─── Main Unified Availability Page ───────────────────────────────────────────
export default function Availability() {
  const [day, setDay] = useState(todayCode())
  const [selectedDate, setSelectedDate] = useState(getTodayISO())
  const [useDateMode, setUseDateMode] = useState(true) // true: query by specific date, false: query day template
  const [view, setView] = useState('heatmap')          // 'heatmap' | 'teacher' | 'period'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [minFree, setMinFree] = useState(0)

  // Fetch data whenever day or selectedDate changes
  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)

    const queryArg = useDateMode && selectedDate ? selectedDate : day
    api.getAvailability(queryArg)
      .then((res) => {
        setData(res)
        if (res.day) {
          setDay(res.day)
        }
      })
      .catch((e) => setError(e.message || 'Could not load availability data.'))
      .finally(() => setLoading(false))
  }, [day, selectedDate, useDateMode])

  // Map: teacher_name -> Set of free period numbers
  const freeMap = useMemo(() => {
    if (!data) return {}
    const map = {}
    for (const t of data.teacher_wise ?? []) {
      map[t.teacher_name] = new Set((t.free_periods ?? []).map((fp) => fp.period))
    }
    return map
  }, [data])

  // Map: teacher_name -> Map(period -> subDuty)
  const subMap = useMemo(() => {
    if (!data) return {}
    const map = {}
    for (const t of data.teacher_wise ?? []) {
      const pMap = {}
      for (const duty of t.substituted_periods ?? []) {
        pMap[duty.period] = duty
      }
      map[t.teacher_name] = pMap
    }
    return map
  }, [data])

  // Map: period -> list of { teacher_name, class_name } on substitution
  const periodSubMap = useMemo(() => {
    if (!data) return {}
    const map = {}
    for (const t of data.teacher_wise ?? []) {
      for (const duty of t.substituted_periods ?? []) {
        if (!map[duty.period]) map[duty.period] = []
        map[duty.period].push({
          teacher_name: t.teacher_name,
          class_name: duty.class_name,
          absent_teacher: duty.absent_teacher,
        })
      }
    }
    return map
  }, [data])

  // Map: period -> list of free teacher names
  const periodFreeMap = useMemo(() => {
    if (!data) return {}
    const map = {}
    for (const pw of data.period_wise ?? []) {
      map[pw.period] = pw.free_teachers ?? []
    }
    return map
  }, [data])

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    if (!data) return []
    let list = data.teacher_wise ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) => t.teacher_name.toLowerCase().includes(q))
    }
    if (minFree > 0) {
      list = list.filter((t) => t.total_free_periods >= minFree)
    }
    return [...list].sort((a, b) => b.total_free_periods - a.total_free_periods)
  }, [data, search, minFree])

  // Filtered periods
  const filteredPeriods = useMemo(() => {
    if (!data) return []
    let list = data.period_wise ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((pw) =>
        pw.free_teachers.some((n) => n.toLowerCase().includes(q)) ||
        `period ${pw.period}`.includes(q)
      )
    }
    return list
  }, [data, search])

  // Summary Metrics
  const totalTeachers = data?.teacher_wise?.length ?? 0
  const totalFreeSlots = data?.teacher_wise?.reduce((s, t) => s + t.total_free_periods, 0) ?? 0
  const totalSubDuties = data?.teacher_wise?.reduce((s, t) => s + (t.total_substituted_periods || 0), 0) ?? 0
  const avgFree = totalTeachers ? (totalFreeSlots / totalTeachers).toFixed(1) : '—'

  const peakPeriod = PERIODS.reduce((best, p) => {
    const cnt = (periodFreeMap[p.period] ?? []).length
    return cnt > (periodFreeMap[best?.period ?? -1] ?? []).length ? p : best
  }, null)
  const peakCount = peakPeriod ? (periodFreeMap[peakPeriod.period] ?? []).length : 0

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">

      {/* ── Top Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-brand-600 print:hidden">Faculty Scheduling &amp; Availability</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold tracking-tight text-slate-900">
            Teacher Availability &amp; Free Windows
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Real-time visual schedule: <span className="font-semibold text-emerald-600">Green</span> = Free, <span className="font-semibold text-rose-600">Red</span> = Assigned Substitution, <span className="font-semibold text-slate-500">Gray</span> = Regular Class.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-colors"
        >
          🖨️ Print Availability
        </button>
      </div>

      {/* ── Date & Day Selectors ── */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
            <span>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setUseDateMode(true)
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setSelectedDate(getTodayISO())
              setUseDateMode(true)
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100"
          >
            Today
          </button>
        </div>

        {/* Day Template selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] text-slate-400 mr-1 hidden sm:inline">Weekday:</span>
          {WORKING_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => {
                setDay(d)
                setUseDateMode(false)
              }}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                day === d && !useDateMode
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="hidden sm:inline">{DAY_LABEL[d]}</span>
              <span className="sm:hidden">{DAY_SHORT[d]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Metrics ── */}
      {data && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Total Teachers</p>
            <p className="mt-1 text-[26px] font-bold text-slate-900">{totalTeachers}</p>
            <p className="text-[12px] text-slate-400">{DAY_LABEL[day]} schedule</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Free Slots</p>
            <p className="mt-1 text-[26px] font-bold text-emerald-600">{totalFreeSlots}</p>
            <p className="text-[12px] text-slate-400">avg {avgFree} per teacher</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Substitution Duties</p>
            <p className="mt-1 text-[26px] font-bold text-rose-600">{totalSubDuties}</p>
            <p className="text-[12px] text-slate-400">
              {totalSubDuties > 0 ? 'Assigned periods (Red)' : 'No active substitutions'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Peak Availability</p>
            {peakPeriod ? (
              <>
                <p className="mt-1 text-[26px] font-bold text-brand-700">{peakPeriod.label}</p>
                <p className="text-[12px] text-slate-400">{peakCount} teachers free · {peakPeriod.time}</p>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-slate-400">—</p>
            )}
          </div>
        </div>
      )}

      {/* ── View Toggle & Search Controls ── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          {[
            { key: 'heatmap', label: '⊞ Heatmap Grid' },
            { key: 'teacher', label: '👤 Teacher Cards' },
            { key: 'period',  label: '≡ Period Breakdown' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                view === key ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {view === 'heatmap' && (
            <select
              value={minFree}
              onChange={(e) => setMinFree(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value={0}>All Teachers</option>
              <option value={3}>≥ 3 Free Periods</option>
              <option value={5}>≥ 5 Free Periods</option>
              <option value={7}>≥ 7 Free Periods</option>
            </select>
          )}

          <input
            type="text"
            placeholder="Search teacher or period…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-700 placeholder-slate-400 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 w-56"
          />
        </div>
      </div>

      {/* ── Main Display Area ── */}
      <div className="mt-5">
        {loading && (
          <div className="mt-16 flex flex-col items-center gap-3 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
            <p className="text-[13px]">Loading availability for {DAY_LABEL[day]}…</p>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* ── 1. HEATMAP GRID VIEW ── */}
        {!loading && !error && data && view === 'heatmap' && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-5 py-3 gap-3 bg-slate-50/50">
              <p className="text-[12px] font-semibold text-slate-600">
                {filteredTeachers.length} faculty member{filteredTeachers.length !== 1 ? 's' : ''} listed
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                  <span className="h-3.5 w-3.5 rounded-sm bg-emerald-500 inline-block ring-1 ring-emerald-400 shadow-xs" />
                  <span className="font-medium text-emerald-800">Green = Free</span>
                </span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                  <span className="h-3.5 w-3.5 rounded-sm bg-rose-500 inline-block ring-1 ring-rose-400 shadow-xs text-white text-[8px] font-bold flex items-center justify-center">S</span>
                  <span className="font-medium text-rose-800">Red = Substitution Given</span>
                </span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                  <span className="h-3.5 w-3.5 rounded-sm bg-slate-100 inline-block border border-slate-200/80" />
                  <span className="font-medium text-slate-500">Gray = Busy</span>
                </span>
              </div>
            </div>

            {filteredTeachers.length === 0 ? (
              <p className="py-16 text-center text-[13px] text-slate-400">No teachers match your filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: '780px' }}>
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="sticky left-0 z-10 bg-slate-50/95 border-b border-slate-200 px-4 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 min-w-[200px]">
                        Teacher
                      </th>
                      <th className="border-b border-slate-200 px-3 py-2.5 text-center text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 w-14">
                        Free
                      </th>
                      {PERIODS.map((p) => (
                        <th key={p.period} className="border-b border-slate-200 px-1 py-2 text-center w-10">
                          <PeriodHeader
                            p={p}
                            freeCount={(periodFreeMap[p.period] ?? []).length}
                            totalTeachers={totalTeachers}
                            subCount={(periodSubMap[p.period] ?? []).length}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.map((t, idx) => {
                      const freePeriods = freeMap[t.teacher_name] ?? new Set()
                      const teacherSubs = subMap[t.teacher_name] ?? {}
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'

                      return (
                        <tr key={t.teacher_name} className={`${rowBg} hover:bg-brand-50/30 transition-colors`}>
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

                          {PERIODS.map((p) => {
                            const isSub = Boolean(teacherSubs[p.period])
                            const isFree = freePeriods.has(p.period)
                            const status = isSub ? 'substituted' : isFree ? 'free' : 'busy'

                            return (
                              <td key={p.period} className="border-b border-slate-100 px-1 py-2 text-center">
                                <div className="flex justify-center">
                                  <HeatCell
                                    status={status}
                                    subDuty={teacherSubs[p.period]}
                                    teacherName={t.teacher_name}
                                    periodLabel={p.label}
                                    timeSlot={p.time}
                                  />
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── 2. TEACHER-WISE CARD ACCORDION VIEW ── */}
        {!loading && !error && data && view === 'teacher' && (
          <div className="space-y-2 print:space-y-1">
            {filteredTeachers.length === 0 ? (
              <p className="mt-8 text-center text-[13px] text-slate-400">No teachers match your search.</p>
            ) : (
              filteredTeachers.map((t) => <TeacherCard key={t.teacher_name} teacher={t} />)
            )}
          </div>
        )}

        {/* ── 3. PERIOD-WISE BREAKDOWN VIEW ── */}
        {!loading && !error && data && view === 'period' && (
          <div className="space-y-2 print:space-y-1">
            {filteredPeriods.length === 0 ? (
              <p className="mt-8 text-center text-[13px] text-slate-400">No periods match your search.</p>
            ) : (
              PERIODS.map((p) => {
                const freeTeachers = (periodFreeMap[p.period] ?? []).filter((name) =>
                  search.trim() === '' || name.toLowerCase().includes(search.trim().toLowerCase())
                )
                const subTeachers = periodSubMap[p.period] ?? []
                const breakAfter = BREAKS_AFTER[p.period]

                return (
                  <div key={p.period} className="flex flex-col gap-2">
                    {p.period === 1 && search === '' && (
                      <div className="flex items-center justify-center rounded-lg bg-indigo-50/80 px-4 py-2 text-[12px] font-bold tracking-widest text-indigo-400 uppercase">
                        🙏 Morning Prayer (8:15 AM – 8:45 AM)
                      </div>
                    )}
                    <PeriodDetailCard p={p} freeTeachers={freeTeachers} subTeachers={subTeachers} />
                    {breakAfter && search === '' && (
                      <div className="my-1.5 flex items-center justify-center gap-2">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                          {breakAfter.label} · {breakAfter.short}
                        </span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

    </div>
  )
}

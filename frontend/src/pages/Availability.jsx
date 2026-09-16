import { useEffect, useState } from 'react'
import { api } from '../lib/api'

// Map JS getDay() (0=Sun…6=Sat) → backend day code
const JS_DAY_TO_CODE = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const WORKING_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_LABEL = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' }

function todayCode() {
  const code = JS_DAY_TO_CODE[new Date().getDay()]
  return WORKING_DAYS.includes(code) ? code : 'MON'
}

// ── Small badge showing count ─────────────────────────────────────────────────
function Badge({ count, tone = 'default' }) {
  const tones = {
    default: 'bg-slate-100 text-slate-600',
    good:    'bg-emerald-50 text-emerald-700',
    warn:    'bg-amber-50 text-amber-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${tones[tone]}`}>
      {count}
    </span>
  )
}

// ── Teacher-wise card ─────────────────────────────────────────────────────────
function TeacherCard({ teacher }) {
  const [open, setOpen] = useState(false)
  const { teacher_name, free_periods, total_free_periods } = teacher

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
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-[12px] text-slate-400">{total_free_periods} free</span>
          <Badge count={total_free_periods} tone={tone} />
          <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
          {free_periods.length === 0 ? (
            <p className="text-[12.5px] text-slate-400 italic">No free periods on this day.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {free_periods.map((fp) => (
                <span
                  key={fp.period}
                  className="inline-flex flex-col items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Period {fp.period}
                  </span>
                  {fp.time_slot ? (
                    <span className="text-[11.5px] text-emerald-600">{fp.time_slot}</span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No time set</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Period-wise row ───────────────────────────────────────────────────────────
function PeriodRow({ pw }) {
  const [open, setOpen] = useState(false)
  const { period, time_slot, free_teachers, total_free } = pw

  const tone = total_free >= 5 ? 'good' : total_free >= 2 ? 'default' : 'warn'

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-[13px] font-bold text-brand-700">
            {period}
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-slate-800">Period {period}</p>
            {time_slot ? (
              <p className="text-[12px] text-slate-400">{time_slot}</p>
            ) : (
              <p className="text-[12px] text-slate-400 italic">Time not configured</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-[12px] text-slate-400">{total_free} available</span>
          <Badge count={total_free} tone={tone} />
          <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
          {free_teachers.length === 0 ? (
            <p className="text-[12.5px] text-slate-400 italic">No teachers free this period.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {free_teachers.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-[12.5px] font-medium text-slate-700"
                >
                  <span className="h-5 w-5 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-bold text-brand-600">
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Availability() {
  const [day, setDay] = useState(todayCode())
  const [view, setView] = useState('teacher') // 'teacher' | 'period'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    setSearch('')
    api.getAvailability(day)
      .then(setData)
      .catch((e) => setError(e.message || 'Could not load availability data.'))
      .finally(() => setLoading(false))
  }, [day])

  // Summary stats
  const totalTeachers  = data?.teacher_wise?.length ?? 0
  const totalFreeSlots = data?.teacher_wise?.reduce((s, t) => s + t.total_free_periods, 0) ?? 0
  const avgFree        = totalTeachers ? (totalFreeSlots / totalTeachers).toFixed(1) : '—'
  const mostFreeTeacher = data?.teacher_wise?.reduce(
    (best, t) => (!best || t.total_free_periods > best.total_free_periods ? t : best),
    null
  )

  // Filtered lists
  const filteredTeachers = (data?.teacher_wise ?? []).filter((t) =>
    t.teacher_name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredPeriods = (data?.period_wise ?? []).filter((pw) =>
    pw.free_teachers.some((n) => n.toLowerCase().includes(search.toLowerCase())) ||
    search === '' ||
    `period ${pw.period}`.includes(search.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-brand-600 print:hidden">Teacher Availability</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold tracking-tight text-slate-900">
            Free Periods — {DAY_LABEL[day]}
          </h1>
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
        {WORKING_DAYS.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors ${
              day === d
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>

      {/* ── Summary Stats ── */}
      {data && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Total Teachers</p>
            <p className="mt-1 text-[26px] font-bold text-slate-900">{totalTeachers}</p>
            <p className="text-[12px] text-slate-400">Active faculty</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Avg Free Periods</p>
            <p className="mt-1 text-[26px] font-bold text-slate-900">{avgFree}</p>
            <p className="text-[12px] text-slate-400">Per teacher today</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Total Free Slots</p>
            <p className="mt-1 text-[26px] font-bold text-emerald-700">{totalFreeSlots}</p>
            <p className="text-[12px] text-slate-400">Across all teachers</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Most Available</p>
            {mostFreeTeacher ? (
              <>
                <p className="mt-1 text-[15px] font-bold text-slate-900 truncate" title={mostFreeTeacher.teacher_name}>
                  {mostFreeTeacher.teacher_name}
                </p>
                <p className="text-[12px] text-slate-400">{mostFreeTeacher.total_free_periods} free periods</p>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-slate-400">—</p>
            )}
          </div>
        </div>
      )}

      {/* ── View toggle + Search ── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            onClick={() => setView('teacher')}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              view === 'teacher' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Teacher-wise
          </button>
          <button
            onClick={() => setView('period')}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              view === 'period' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Period-wise
          </button>
        </div>

        <input
          type="text"
          placeholder={view === 'teacher' ? 'Search teacher…' : 'Search teacher or period…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-700 placeholder-slate-400 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 w-56"
        />
      </div>

      {/* ── Content ── */}
      <div className="mt-4">
        {loading && (
          <div className="mt-12 flex flex-col items-center gap-3 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
            <p className="text-[13px]">Loading availability for {DAY_LABEL[day]}…</p>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {view === 'teacher' && (
              <div className="space-y-2 print:space-y-1">
                {filteredTeachers.length === 0 ? (
                  <p className="mt-8 text-center text-[13px] text-slate-400">No teachers match your search.</p>
                ) : (
                  filteredTeachers.map((t) => <TeacherCard key={t.teacher_name} teacher={t} />)
                )}
              </div>
            )}

            {view === 'period' && (
              <div className="space-y-2 print:space-y-1">
                {filteredPeriods.length === 0 ? (
                  <p className="mt-8 text-center text-[13px] text-slate-400">No periods match your search.</p>
                ) : (
                  filteredPeriods.map((pw, index) => {
                    const isLast = index === filteredPeriods.length - 1;
                    const nextPw = isLast ? null : filteredPeriods[index + 1];
                    const showMorningPrayer = search === '' && pw.period === 1;
                    const showShortBreak = search === '' && pw.period === 2 && nextPw?.period === 3;
                    const showLongBreak = search === '' && pw.period === 7 && nextPw?.period === 8;
                    const showAfternoonPrayer = search === '' && pw.period === 10 && nextPw?.period === 11;
                    
                    return (
                      <div key={pw.period} className="flex flex-col gap-2">
                        {showMorningPrayer && (
                          <div className="flex items-center justify-center rounded-lg bg-indigo-50/80 px-4 py-2 text-[12px] font-bold tracking-widest text-indigo-400 uppercase">
                            🙏 Morning Prayer (8:15 AM – 8:45 AM)
                          </div>
                        )}
                        <PeriodRow pw={pw} />
                        {showShortBreak && (
                          <div className="flex items-center justify-center rounded-lg bg-slate-100/80 px-4 py-2 text-[12px] font-bold tracking-widest text-slate-400 uppercase">
                            ☕ Short Break (9:45 AM – 10:00 AM)
                          </div>
                        )}
                        {showLongBreak && (
                          <div className="flex items-center justify-center rounded-lg bg-slate-100/80 px-4 py-2 text-[12px] font-bold tracking-widest text-slate-400 uppercase">
                            🍽️ Long Break (12:30 PM – 1:00 PM)
                          </div>
                        )}
                        {showAfternoonPrayer && (
                          <div className="flex items-center justify-center rounded-lg bg-indigo-50/80 px-4 py-2 text-[12px] font-bold tracking-widest text-indigo-400 uppercase">
                            🙏 Afternoon Prayer (2:35 PM – 2:40 PM)
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}

        {!loading && !error && !data && (
          <p className="mt-12 text-center text-[13px] text-slate-400">Select a day to view availability.</p>
        )}
      </div>
    </div>
  )
}

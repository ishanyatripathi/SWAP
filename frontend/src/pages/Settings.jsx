import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const ALL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function Settings() {
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState('')

  useEffect(() => {
    api.getSettings().then(setForm).catch(() => {})
  }, [])

  if (!form) return <div className="mx-auto max-w-6xl px-6 py-8 text-[13.5px] text-slate-400">Loading…</div>

  const toggleDay = (day) => {
    setForm((f) => ({
      ...f,
      working_days: f.working_days.includes(day)
        ? f.working_days.filter((d) => d !== day)
        : [...f.working_days, day],
    }))
  }

  const updatePeriodTiming = (period, field, value) => {
    setForm((f) => {
      const timings = [...f.period_timings]
      const idx = timings.findIndex((t) => t.period === period)
      if (idx >= 0) timings[idx] = { ...timings[idx], [field]: value }
      else timings.push({ period, start: '', end: '', [field]: value })
      return { ...f, period_timings: timings }
    })
  }

  const handleSave = async () => {
    await api.updateSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    if (!window.confirm('This will permanently delete settings, timetables, uploads, teachers, classes, and substitution history. Continue?')) return
    if (window.prompt('Type RESET to confirm permanent deletion.') !== 'RESET') return

    setResetting(true)
    setResetMessage('')
    try {
      await api.resetApplication()
      const freshSettings = await api.getSettings()
      setForm(freshSettings)
      setResetMessage('Everything was reset. The app is ready for new setup.')
    } catch (error) {
      setResetMessage(error.message || 'Reset failed.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-slate-900">Settings</h1>
      <p className="mt-1 text-[13.5px] text-slate-500">School-wide configuration used across the app.</p>

      <div className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-[13px] font-medium text-slate-600">
            School name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
            />
          </label>
          <label className="text-[13px] font-medium text-slate-600">
            Academic year
            <input
              value={form.academic_year}
              onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
            />
          </label>
        </div>

        <div>
          <p className="text-[13px] font-medium text-slate-600">Working days</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_DAYS.map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition ${
                  form.working_days.includes(day)
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-[13px] font-medium text-slate-600">
          Periods per day
          <input
            type="number"
            min={1}
            max={12}
            value={form.periods_per_day}
            onChange={(e) => setForm({ ...form, periods_per_day: Number(e.target.value) })}
            className="mt-1.5 w-32 rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
          />
        </label>

        <div>
          <p className="text-[13px] font-medium text-slate-600">Period timing</p>
          <div className="mt-2 space-y-2">
            {Array.from({ length: form.periods_per_day }, (_, i) => i + 1).map((period) => {
              const timing = form.period_timings.find((t) => t.period === period) || { start: '', end: '' }
              return (
                <div key={period} className="flex items-center gap-3">
                  <span className="w-16 text-[13px] font-medium text-slate-500">Period {period}</span>
                  <input
                    type="time"
                    value={timing.start}
                    onChange={(e) => updatePeriodTiming(period, 'start', e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="time"
                    value={timing.end}
                    onChange={(e) => updatePeriodTiming(period, 'end', e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]"
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-700"
          >
            Save changes
          </button>
          {saved && <span className="text-[13px] text-emerald-600">Saved.</span>}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-[14px] font-semibold text-red-800">Reset S.W.A.P</h2>
        <p className="mt-1 text-[13px] text-red-700">
          Permanently deletes all settings, uploaded timetables, teachers, classes, and substitution history.
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
        >
          {resetting ? 'Resetting…' : 'Reset everything'}
        </button>
        {resetMessage && <p className="mt-3 text-[13px] text-red-700">{resetMessage}</p>}
      </div>
    </div>
  )
}

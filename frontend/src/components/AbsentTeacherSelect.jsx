import { useMemo, useState } from 'react'

/**
 * Searchable multi-select for marking teachers absent. Deliberately built
 * as a lightweight custom component (no external combobox dependency) —
 * the interaction surface is small enough that a simple filtered list with
 * checkboxes is faster to use than a heavier combobox, and it's fully
 * keyboard/screen-reader friendly by default since it's just inputs.
 */
export default function AbsentTeacherSelect({ teachers, selected, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(
    () => teachers.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())),
    [teachers, query]
  )

  const toggle = (name) => {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name])
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        {selected.map((name) => (
          <span
            key={name}
            className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-[13px] font-medium text-brand-700"
          >
            {name}
            <button
              type="button"
              onClick={() => toggle(name)}
              className="text-brand-400 hover:text-brand-700"
              aria-label={`Remove ${name}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={selected.length === 0 ? 'Search and select absent teachers…' : 'Add another…'}
          className="min-w-[160px] flex-1 border-none bg-transparent px-1 py-1 text-[14px] text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-card">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-slate-400">No teachers match “{query}”.</p>
          )}
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle(t.name)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13.5px] text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10.5px] font-semibold text-slate-500">
                  {t.name.replace(/^(Mr\.|Mrs\.|Ms\.)\s*/, '')[0]}
                </span>
                {t.name}
                {t.subject && <span className="text-[12px] text-slate-400">· {t.subject}</span>}
              </span>
              {selected.includes(t.name) && <span className="text-brand-600">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

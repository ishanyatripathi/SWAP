import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

function UploadCard({ kind, title, description, onUploaded }) {
  const inputRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | uploading | success | failed
  const [message, setMessage] = useState('')

  const handleFile = async (file) => {
    if (!file) return
    setStatus('uploading')
    setMessage('')
    try {
      const result = await api.uploadTimetable(kind, file)
      if (result.status === 'success') {
        setStatus('success')
        setMessage(`${result.rows_imported} lecture rows imported from ${result.filename}.`)
      } else {
        setStatus('failed')
        setMessage(result.error_message || 'Could not parse this JSON file.')
      }
      onUploaded?.()
    } catch (e) {
      setStatus('failed')
      setMessage(e.message || 'Upload failed.')
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <p className="text-[14px] font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-[13px] text-slate-500">{description}</p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleFile(e.dataTransfer.files?.[0])
        }}
        className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center"
      >
        <p className="text-[13px] text-slate-500">Drag & drop the JSON here, or</p>
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
        >
          Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {status !== 'idle' && (
        <div
          className={`mt-3 rounded-lg px-3.5 py-2.5 text-[12.5px] ${
            status === 'uploading'
              ? 'bg-slate-50 text-slate-500'
              : status === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {status === 'uploading' ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span>Parsing timetable…</span>
                <span className="text-[11px] text-slate-400">Please wait</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
              </div>
            </>
          ) : message}
        </div>
      )}
    </div>
  )
}

export default function Timetables() {
  const [uploads, setUploads] = useState([])

  const refresh = () => api.listUploads().then(setUploads).catch(() => {})
  const handleDelete = async (upload) => {
    if (!window.confirm(`Delete ${upload.filename} from upload history?`)) return
    await api.deleteUpload(upload.id)
    refresh()
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-slate-900">Timetables</h1>
      <p className="mt-1 text-[13.5px] text-slate-500">
        Upload the JSON timetable export for each timetable view. The app reads the assignment data directly and stores it for daily substitution planning.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <UploadCard
          kind="faculty"
          title="Faculty Timetable"
          description="JSON export of every teacher's weekly schedule."
          onUploaded={refresh}
        />
        <UploadCard
          kind="class"
          title="Student Class-wise Timetable"
          description="JSON export of each class or section timetable with teacher initials."
          onUploaded={refresh}
        />
      </div>

      <div className="mt-10">
        <p className="mb-3 text-[13px] font-semibold text-slate-700">Upload history</p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          {uploads.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-slate-400">No timetables uploaded yet.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5">File</th>
                  <th className="px-5 py-2.5">Type</th>
                  <th className="px-5 py-2.5">Rows</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Uploaded</th>
                  <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-800">{u.filename}</td>
                    <td className="px-5 py-3 capitalize text-slate-500">{u.kind}</td>
                    <td className="px-5 py-3 text-slate-500">{u.rows_imported}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${
                          u.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : u.status === 'failed'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{new Date(u.uploaded_at).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        title={`Delete ${u.filename}`}
                        aria-label={`Delete ${u.filename}`}
                        className="text-slate-400 hover:text-red-600"
                      >
                        &#x1F5D1;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

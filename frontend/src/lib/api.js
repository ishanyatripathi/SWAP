/**
 * Thin fetch wrapper around the ClassCover API.
 * Centralizing this here means the base URL (and later, auth headers
 * for the multi-school SaaS version) only needs to change in one place.
 */
const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  getTeachers: () => request('/teachers'),
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  resetApplication: () => request('/settings/reset', { method: 'POST' }),
  listUploads: () => request('/timetables/uploads'),
  deleteUpload: (uploadId) => request(`/timetables/uploads/${uploadId}`, { method: 'DELETE' }),
  uploadTimetable: (kind, file) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${BASE_URL}/timetables/upload?kind=${kind}`, { method: 'POST', body: form })
      .then(async (res) => {
        if (!res.ok) throw new Error('Upload failed')
        return res.json()
      })
  },
  // Step 1: get every lecture needing coverage + all free-teacher options for each.
  previewSubstitutions: (date, absentTeacherNames) =>
    request('/substitutions/preview', {
      method: 'POST',
      body: JSON.stringify({ date, absent_teacher_names: absentTeacherNames }),
    }),
  // Step 2: persist the coordinator's final (possibly overridden) picks.
  confirmSubstitutions: (date, absentTeacherNames, entries) =>
    request('/substitutions/confirm', {
      method: 'POST',
      body: JSON.stringify({ date, absent_teacher_names: absentTeacherNames, entries }),
    }),
  listRuns: (dateFrom, dateTo) => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    return request(`/substitutions?${params.toString()}`)
  },
}

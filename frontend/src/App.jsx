import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Timetables from './pages/Timetables'
import History from './pages/History'
import Settings from './pages/Settings'
import Availability from './pages/Availability'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/timetables" element={<Timetables />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/availability" element={<Availability />} />
          </Routes>
        </main>
        <footer className="px-6 py-4 text-center text-xs text-slate-400">
          Built by CORE Technologies
        </footer>
      </div>
    </BrowserRouter>
  )
}

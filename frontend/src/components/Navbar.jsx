import { NavLink } from 'react-router-dom'
import logo from '../../assets/logo.png'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/timetables', label: 'Timetables' },
  { to: '/history', label: 'History' },
  { to: '/availability', label: 'Availability' },
  { to: '/settings', label: 'Settings' },
]

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="S.W.A.P logo" className="h-8 w-8 rounded-lg object-contain" />
          <div title="Smart Workflow Allocation & Placement">
            <span className="font-display text-[17px] font-semibold tracking-tight text-slate-900">
              S.W.A.P
            </span>
            <span className="ml-2 hidden text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:inline">
              Smart Workflow Allocation &amp; Placement
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

      </div>
    </header>
  )
}

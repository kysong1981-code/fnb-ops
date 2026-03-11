import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { HomeIcon, CalendarIcon, ClockIcon, BriefcaseIcon } from '../icons'

const allTabs = [
  { id: 'home', label: 'Home', icon: HomeIcon, path: '/dashboard' },
  { id: 'schedule', label: 'Schedule', icon: CalendarIcon, path: '/roster', module: 'ROSTER' },
  { id: 'clock', label: 'Time Clock', icon: ClockIcon, path: '/timesheet', module: 'TIMESHEET' },
  { id: 'desk', label: 'My Desk', icon: BriefcaseIcon, path: '/mypage' },
]

export default function EmployeeBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isModuleEnabled } = useAuth()

  const tabs = allTabs.filter(tab => !tab.module || isModuleEnabled(tab.module))

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 pb-safe">
      <div className="flex justify-around px-2 py-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path)
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all ${
                active ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{tab.label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-blue-600" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

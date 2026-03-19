import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  HomeIcon, UserIcon, CalendarIcon, ClockIcon, CheckCircleIcon, ShieldIcon,
  TeamIcon, ClipboardIcon, ChartIcon, DocumentIcon, SettingsIcon,
  LogoutIcon, MenuIcon, XIcon, MoneyIcon, BellIcon, UploadIcon
} from '../icons'

// Roles that can access manager-level features
const MANAGER_ROLES = ['CEO', 'HQ', 'ADMIN', 'REGIONAL_MANAGER', 'SENIOR_MANAGER', 'MANAGER']

const menuSections = [
  {
    title: null,
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: HomeIcon },
    ]
  },
  {
    title: 'My Work',
    roles: ['EMPLOYEE'],
    items: [
      { label: 'My Roster', path: '/roster', icon: CalendarIcon },
      { label: 'My Tasks', path: '/tasks', icon: CheckCircleIcon },
      { label: 'Food Safety', path: '/safety', icon: ShieldIcon },
      { label: 'Documents', path: '/documents', icon: DocumentIcon },
    ]
  },
  {
    title: null,
    roles: ['CEO', 'HQ'],
    items: [
      { label: 'CQ Report', path: '/cq-report', icon: MoneyIcon },
    ]
  },
  {
    title: 'Manager',
    roles: MANAGER_ROLES,
    items: [
      { label: 'Daily Closing', path: '/closing', icon: ClipboardIcon, module: 'CLOSING' },
      { label: 'Cash Management', path: '/cashup', icon: MoneyIcon, module: 'CASHUP' },
      { label: 'Reports', path: '/reports', icon: ChartIcon, module: 'REPORTS' },
      { label: 'Sales Analysis', path: '/sales', icon: ChartIcon, module: 'SALES' },
      { label: 'HR Management', path: '/hr', icon: TeamIcon, module: 'HR' },
      { label: 'Assign Tasks', path: '/manager/assign-tasks', icon: CheckCircleIcon, module: 'TASKS' },
      { label: 'Safety Records', path: '/safety/inspection', icon: ShieldIcon, module: 'SAFETY' },
      { label: 'Data Import', path: '/import', icon: UploadIcon, module: 'REPORTS' },
    ]
  },
  {
    title: 'Schedule',
    roles: MANAGER_ROLES,
    items: [
      { label: 'Roster Management', path: '/manager/roster', icon: CalendarIcon, module: 'ROSTER' },
      { label: 'Timesheet Review', path: '/manager/timesheet-review', icon: ClockIcon, module: 'TIMESHEET' },
      { label: 'Payroll', path: '/manager/payroll', icon: MoneyIcon, module: 'PAYROLL' },
    ]
  },
  {
    title: 'Admin',
    roles: ['CEO', 'HQ'],
    items: [
      { label: 'Applications', path: '/admin/applications', icon: ClipboardIcon },
      { label: 'Store Assignment', path: '/admin/store-assignment', icon: SettingsIcon },
    ]
  },
  {
    title: 'Settings',
    roles: MANAGER_ROLES,
    items: [
      { label: 'Store Settings', path: '/store-settings', icon: SettingsIcon },
      { label: 'Documents', path: '/documents', icon: DocumentIcon, module: 'DOCUMENTS' },
    ]
  },
]

export default function ManagerSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isModuleEnabled } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  const handleNav = (path) => {
    navigate(path)
    setMobileOpen(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const firstName = user?.user?.first_name || user?.user?.username || ''
  const initials = firstName.charAt(0).toUpperCase()

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6">
        <button onClick={() => handleNav('/dashboard')} className="text-lg font-bold tracking-tight text-gray-900 hover:text-gray-700">
          Oneops
        </button>
        <p className="text-xs text-gray-400 mt-0.5">{user?.organization_detail?.name || 'Store'}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto">
        {menuSections.map((section) => {
          // Role-based section filtering (e.g., Admin section only for CEO/HQ)
          if (section.roles && !section.roles.includes(user?.role)) return null
          const visibleItems = section.items.filter(item => !item.module || isModuleEnabled(item.module))
          if (visibleItems.length === 0) return null
          return (
          <div key={section.title || 'general'}>
            {section.title && (
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest px-3 mb-2">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={() => handleNav('/mypage')}
          className="flex items-center gap-2 px-2 mb-3 w-full rounded-xl hover:bg-gray-50 py-2 transition"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-gray-700 truncate">{firstName}</p>
            <p className="text-xs text-gray-400">{user?.role?.replace('_', ' ')}</p>
          </div>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 justify-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
        >
          <LogoutIcon size={16} />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar (always visible on lg+) */}
      <aside className="hidden lg:flex w-56 bg-white border-r border-gray-100 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile: slide-out drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 h-full w-64 bg-white z-50 shadow-lg lg:hidden">
            <div className="flex justify-end p-3">
              <button onClick={() => setMobileOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <XIcon size={20} />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Mobile menu toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50"
        aria-label="Menu"
      >
        <MenuIcon size={20} className="text-gray-600" />
      </button>
    </>
  )
}

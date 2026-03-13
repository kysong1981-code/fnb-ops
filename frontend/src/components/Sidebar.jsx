import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const managerRoles = ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN']
  const allRoles = ['EMPLOYEE', ...managerRoles]

  const menuSections = [
    {
      title: null,
      roles: allRoles,
      items: [
        { label: 'Dashboard', path: '/dashboard', roles: allRoles },
        { label: 'My Page', path: '/mypage', roles: ['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'ADMIN'] },
        { label: 'My Leave', path: '/leave', roles: allRoles },
      ]
    },
    {
      title: 'Manager',
      roles: managerRoles,
      items: [
        { label: 'Daily Closing', path: '/closing', roles: managerRoles },
        { label: 'Cash Management', path: '/cashup', roles: managerRoles },
        { label: 'Reports', path: '/reports', roles: managerRoles },
        { label: 'Sales Analysis', path: '/sales', roles: managerRoles },
        { label: 'Roster Management', path: '/manager/roster', roles: managerRoles },
        { label: 'Timesheet Review', path: '/manager/timesheet-review', roles: managerRoles },
        { label: 'HR Management', path: '/hr', roles: managerRoles },
        { label: 'Payroll', path: '/manager/payroll', roles: managerRoles },
        { label: 'Assign Tasks', path: '/manager/assign-tasks', roles: managerRoles },
      ]
    },
    {
      title: 'Settings & Docs',
      roles: allRoles,
      items: [
        { label: 'Store Settings', path: '/store-settings', roles: managerRoles },
        { label: 'Documents', path: '/documents', roles: allRoles },
      ]
    },
  ]

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  const handleMenuItemClick = (path) => {
    navigate(path)
    setMenuOpen(false)
  }

  return (
    <>
      {/* Top Header with Home, Back, Hamburger */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="px-4 py-4 flex items-center justify-between">
          {/* Left: Back + Home buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Back"
            >
              <span className="text-xl">←</span>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Home"
            >
              <span className="text-xl">🏠</span>
            </button>
          </div>

          {/* Logo/Title */}
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xl font-bold text-gray-900 hover:text-gray-700"
          >
            Oneops
          </button>

          {/* Right: Hamburger Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Menu"
          >
            <span className="text-2xl">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </header>

      {/* Slide-out Menu */}
      {menuOpen && (
        <div className="fixed right-0 top-16 h-full w-64 bg-white shadow-lg z-30 overflow-y-auto flex flex-col border-l border-gray-200">
          {/* User Info */}
          <div className="p-4 border-b border-gray-200">
            <p className="font-bold text-lg text-gray-900">{user?.user?.first_name || user?.user?.username}</p>
            <p className="text-gray-500 text-sm">{user?.role?.replace('_', ' ')}</p>
          </div>

          <nav className="p-3 space-y-3 flex-1 overflow-y-auto">
            {menuSections.map((section) => {
              const sectionVisible = user && section.roles.includes(user.role)
              const visibleItems = section.items.filter(item => user && item.roles.includes(user.role))
              if (!sectionVisible || visibleItems.length === 0) return null

              return (
                <div key={section.title || 'general'} className="bg-gray-50 rounded-xl p-2">
                  {section.title && (
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-3 py-2">
                      {section.title}
                    </p>
                  )}
                  {visibleItems.map(item => (
                    <button
                      key={item.path}
                      onClick={() => handleMenuItemClick(item.path)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition font-medium text-sm ${
                        isActive(item.path)
                          ? 'bg-gray-200 text-gray-900'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )
            })}
          </nav>

          {/* Logout Button at Bottom */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 rounded-lg transition text-white font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Overlay when menu is open */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 top-16"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </>
  )
}

import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useState } from 'react'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navigationItems = [
    { label: 'Dashboard', path: '/dashboard', roles: ['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN'] },
    { label: 'My Roster', path: '/hr', roles: ['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'ADMIN'] },
    { label: 'My Payslips', path: '/payroll', roles: ['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'ADMIN'] },
    { label: 'Daily Closing', path: '/closing', roles: ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN'] },
    { label: 'Sales Analysis', path: '/sales', roles: ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN'] },
    { label: 'Reports', path: '/reports', roles: ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN'] },
    { label: 'Food Safety', path: '/safety', roles: ['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN'] },
    { label: 'Documents', path: '/documents', roles: ['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN'] },
  ]

  const visibleItems = navigationItems.filter(item => user && item.roles.includes(user.role))
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="px-4 py-4">
        {/* Top Row */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-2xl font-bold text-indigo-600 hover:text-indigo-700"
          >
            Oneops
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Logout
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden px-3 py-2 text-lg text-gray-700 hover:bg-gray-100 rounded-lg transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Navigation - Always Visible */}
        <nav className={`gap-2 ${mobileMenuOpen ? 'block space-y-2' : 'hidden'} sm:grid sm:grid-cols-4 lg:grid-cols-8`}>
          {visibleItems.map(item => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path)
                setMobileMenuOpen(false)
              }}
              className={`px-3 py-2 text-sm font-medium rounded-md transition whitespace-nowrap text-center ${
                isActive(item.path)
                  ? 'text-indigo-600 bg-indigo-50'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}

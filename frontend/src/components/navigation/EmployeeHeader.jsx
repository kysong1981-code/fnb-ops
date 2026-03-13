import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { BellIcon, LogoutIcon } from '../icons'

export default function EmployeeHeader() {
  const { user, logout, roleOverride, setRoleOverride, isTestOrg } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const firstName = user?.user?.first_name || user?.user?.username || ''
  const initials = firstName.charAt(0).toUpperCase()

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <>
    {isTestOrg && roleOverride && (
      <div className="bg-amber-400 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-900">Test Mode: {roleOverride}</span>
        <button
          onClick={() => setRoleOverride(null)}
          className="text-xs font-bold text-amber-900 bg-amber-300 px-2 py-0.5 rounded hover:bg-amber-200 transition"
        >
          Back to CEO
        </button>
      </div>
    )}
    <header className="bg-white px-5 pt-4 pb-3 shrink-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{getGreeting()} 👋</p>
          <p className="text-lg font-bold text-gray-900">{firstName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition">
            <BellIcon size={18} className="text-gray-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm"
            >
              {initials}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{firstName}</p>
                  <p className="text-xs text-gray-400">{user?.role || ''}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); logout() }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <LogoutIcon size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    </>
  )
}

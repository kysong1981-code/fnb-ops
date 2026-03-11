import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import { BellIcon, SunIcon, UserIcon, SettingsIcon, ClipboardIcon, LogoutIcon, HomeIcon } from '../icons'

export default function ManagerHeader() {
  const { user, logout } = useAuth()
  const { stores, selectedStore, selectStore } = useStore()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const firstName = user?.user?.first_name || user?.user?.username || ''
  const initials = firstName.charAt(0).toUpperCase()
  const role = user?.role?.replace('_', ' ') || ''
  const isCeoOrHq = ['CEO', 'HQ'].includes(user?.role)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNav = (path) => {
    navigate(path)
    setDropdownOpen(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleStoreSelect = (store) => {
    selectStore(store)
    setDropdownOpen(false)
  }

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <SunIcon size={16} className="text-gray-400" />
            <p className="text-sm text-gray-500">
              {getGreeting()}, <span className="font-semibold text-gray-700">{firstName}</span>
            </p>
          </div>
          {/* Selected Store Name */}
          {selectedStore && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
              <HomeIcon size={14} className="text-blue-500" />
              <span className="text-sm font-medium text-blue-700">{selectedStore.name}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition">
            <BellIcon size={18} className="text-gray-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
          </button>

          {/* Avatar with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
            >
              {initials}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{firstName}</p>
                  <p className="text-xs text-gray-400">{role}</p>
                </div>

                {/* Store Selector (CEO/HQ only, multiple stores) */}
                {stores.length > 1 && (
                  <div className="border-b border-gray-100 py-2">
                    <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Store</p>
                    <div className="max-h-40 overflow-y-auto">
                      {stores.map((store) => (
                        <button
                          key={store.id}
                          onClick={() => handleStoreSelect(store)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition ${
                            selectedStore?.id === store.id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <HomeIcon size={14} />
                          <span className="truncate">{store.name}</span>
                          {selectedStore?.id === store.id && (
                            <span className="ml-auto text-blue-500 text-xs">&#10003;</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => handleNav('/mypage')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    <UserIcon size={16} />
                    My Page
                  </button>

                  <button
                    onClick={() => handleNav('/store-settings')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    <SettingsIcon size={16} />
                    Store Settings
                  </button>

                  {isCeoOrHq && (
                    <button
                      onClick={() => handleNav('/admin/applications')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
                    >
                      <ClipboardIcon size={16} />
                      Store Applications
                    </button>
                  )}
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition"
                  >
                    <LogoutIcon size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

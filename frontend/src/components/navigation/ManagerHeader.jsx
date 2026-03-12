import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import { BellIcon, SunIcon, UserIcon, LogoutIcon, HomeIcon, BuildingIcon } from '../icons'

export default function ManagerHeader() {
  const { user, logout } = useAuth()
  const { stores, selectedStore, selectStore, allStoresOption } = useStore()
  const navigate = useNavigate()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)
  const avatarRef = useRef(null)
  const storeRef = useRef(null)

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const firstName = user?.user?.first_name || user?.user?.username || ''
  const initials = firstName.charAt(0).toUpperCase()
  const role = user?.role?.replace('_', ' ') || ''
  const isAllStores = selectedStore?.id === 'all'
  const hasMultipleStores = stores.length > 1 || allStoresOption

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
      if (storeRef.current && !storeRef.current.contains(e.target)) setStoreOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleStoreSelect = (store) => {
    selectStore(store)
    setStoreOpen(false)
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

          {/* Store Selector Dropdown */}
          {selectedStore && hasMultipleStores ? (
            <div className="relative hidden sm:block" ref={storeRef}>
              <button
                onClick={() => setStoreOpen(!storeOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  isAllStores ? 'bg-purple-50 hover:bg-purple-100' : 'bg-blue-50 hover:bg-blue-100'
                }`}
              >
                {isAllStores ? (
                  <BuildingIcon size={14} className="text-purple-500" />
                ) : (
                  <HomeIcon size={14} className="text-blue-500" />
                )}
                <span className={`text-sm font-medium ${isAllStores ? 'text-purple-700' : 'text-blue-700'}`}>
                  {selectedStore.name}
                </span>
                <svg className={`w-3.5 h-3.5 transition-transform ${storeOpen ? 'rotate-180' : ''} ${isAllStores ? 'text-purple-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {storeOpen && (
                <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  {allStoresOption && (
                    <button
                      onClick={() => handleStoreSelect(allStoresOption)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                        isAllStores ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <BuildingIcon size={14} />
                      <span className="truncate">{allStoresOption.name}</span>
                      {isAllStores && <span className="ml-auto text-purple-500 text-xs">✓</span>}
                    </button>
                  )}
                  <div className="max-h-48 overflow-y-auto">
                    {stores.map((store) => (
                      <button
                        key={store.id}
                        onClick={() => handleStoreSelect(store)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                          selectedStore?.id === store.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <HomeIcon size={14} />
                        <span className="truncate">{store.name}</span>
                        {selectedStore?.id === store.id && <span className="ml-auto text-blue-500 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : selectedStore && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50">
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
          <div className="relative" ref={avatarRef}>
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
            >
              {initials}
            </button>

            {avatarOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{firstName}</p>
                  <p className="text-xs text-gray-400">{role}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { navigate('/mypage'); setAvatarOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    <UserIcon size={16} />
                    My Page
                  </button>
                </div>

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

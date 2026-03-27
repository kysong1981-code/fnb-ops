import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import { storeAPI } from '../../services/api'
import { BellIcon, SunIcon, UserIcon, LogoutIcon, HomeIcon } from '../icons'

const ROLE_OPTIONS = [
  { value: 'CEO', label: 'CEO', icon: '👑' },
  { value: 'REGIONAL_MANAGER', label: 'Regional', icon: '🌏' },
  { value: 'MANAGER', label: 'Manager', icon: '🏪' },
  { value: 'EMPLOYEE', label: 'Employee', icon: '👤' },
]

export default function ManagerHeader() {
  const { user, logout, setRoleOverride, roleOverride, isTestOrg, realUser } = useAuth()
  const { stores, selectedStore, selectStore } = useStore()
  const navigate = useNavigate()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [addStoreOpen, setAddStoreOpen] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [addStoreError, setAddStoreError] = useState('')
  const [addStoreLoading, setAddStoreLoading] = useState(false)
  const avatarRef = useRef(null)
  const storeRef = useRef(null)
  const roleRef = useRef(null)

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const firstName = user?.user?.first_name || user?.user?.username || ''
  const initials = firstName.charAt(0).toUpperCase()
  const role = user?.role?.replace('_', ' ') || ''
  const hasMultipleStores = stores.length > 1

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
      if (storeRef.current && !storeRef.current.contains(e.target)) setStoreOpen(false)
      if (roleRef.current && !roleRef.current.contains(e.target)) setRoleOpen(false)
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

  const handleRoleSelect = (role) => {
    setRoleOverride(role)
    setRoleOpen(false)
    navigate('/dashboard')
  }

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return
    setAddStoreLoading(true)
    setAddStoreError('')
    try {
      await storeAPI.createStore({ name: newStoreName.trim() })
      setAddStoreOpen(false)
      setNewStoreName('')
      window.location.reload()
    } catch (err) {
      setAddStoreError(err.response?.data?.error || 'Failed to create store')
    } finally {
      setAddStoreLoading(false)
    }
  }

  const isCEO = user?.role === 'CEO' || user?.role === 'HQ' || user?.role === 'ADMIN'
  const currentRole = user?.role || ''
  const currentRoleOption = ROLE_OPTIONS.find(r => r.value === currentRole)

  return (
    <>
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer bg-blue-50 hover:bg-blue-100"
              >
                <HomeIcon size={14} className="text-blue-500" />
                <span className="text-sm font-medium text-blue-700">
                  {selectedStore.name}
                </span>
                <svg className={`w-3.5 h-3.5 transition-transform ${storeOpen ? 'rotate-180' : ''} text-blue-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {storeOpen && (
                <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
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

          {/* Role Switcher (OneOps test org only) */}
          {isTestOrg && realUser?.role === 'CEO' && (
            <div className="relative hidden sm:block" ref={roleRef}>
              <button
                onClick={() => setRoleOpen(!roleOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  roleOverride ? 'bg-amber-50 hover:bg-amber-100' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <span className="text-sm">{currentRoleOption?.icon || '👤'}</span>
                <span className={`text-xs font-medium ${roleOverride ? 'text-amber-700' : 'text-gray-600'}`}>
                  {currentRoleOption?.label || currentRole}
                </span>
                {roleOverride && <span className="text-[10px] text-amber-500">(Test)</span>}
                <svg className={`w-3 h-3 transition-transform ${roleOpen ? 'rotate-180' : ''} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {roleOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleRoleSelect(opt.value === realUser.role ? null : opt.value)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                        currentRole === opt.value ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                      {currentRole === opt.value && <span className="ml-auto text-amber-500 text-xs">✓</span>}
                      {opt.value === realUser.role && <span className="ml-auto text-gray-400 text-[10px]">original</span>}
                    </button>
                  ))}
                </div>
              )}
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
                  {isCEO && (
                    <button
                      onClick={() => { setAddStoreOpen(true); setAvatarOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
                    >
                      <HomeIcon size={16} />
                      Add Store
                    </button>
                  )}
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

    {/* Add Store Modal */}
    {addStoreOpen && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={() => setAddStoreOpen(false)}>
        <div className="bg-white rounded-2xl shadow-xl w-96 p-6" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-gray-800 mb-4">Add New Store</h3>
          <input
            type="text"
            value={newStoreName}
            onChange={e => { setNewStoreName(e.target.value); setAddStoreError('') }}
            placeholder="Store name"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAddStore()}
          />
          {addStoreError && <p className="text-red-500 text-xs mt-2">{addStoreError}</p>}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => { setAddStoreOpen(false); setNewStoreName(''); setAddStoreError('') }}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddStore}
              disabled={!newStoreName.trim() || addStoreLoading}
              className="flex-1 px-4 py-2.5 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {addStoreLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

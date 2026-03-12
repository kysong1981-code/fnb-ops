import { useState, useEffect } from 'react'
import { adminAPI } from '../../services/api'
import { useStore } from '../../context/StoreContext'
import { TeamIcon, HomeIcon } from '../icons'

const ROLE_OPTIONS = [
  { value: 'EMPLOYEE', label: 'Employee', color: 'bg-gray-100 text-gray-600' },
  { value: 'MANAGER', label: 'Store Manager', color: 'bg-blue-100 text-blue-700' },
  { value: 'SENIOR_MANAGER', label: 'Area Manager', color: 'bg-orange-100 text-orange-700' },
  { value: 'REGIONAL_MANAGER', label: 'Enterprise Manager', color: 'bg-purple-100 text-purple-700' },
]

const MANAGER_ROLES = ['REGIONAL_MANAGER', 'SENIOR_MANAGER']

export default function StoreAssignment() {
  const { stores } = useStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [message, setMessage] = useState(null)
  const [expandedUser, setExpandedUser] = useState(null)
  const [filter, setFilter] = useState('ALL') // ALL, MANAGERS, EMPLOYEES

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await adminAPI.getManagerStores()
      setUsers(res.data)
    } catch (err) {
      console.error('Failed to load users', err)
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (msg, isError = false) => {
    setMessage({ text: msg, isError })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleRoleChange = async (user, newRole) => {
    setSaving(user.id)
    try {
      const storeIds = MANAGER_ROLES.includes(newRole) ? user.managed_stores.map(s => s.id) : []
      await adminAPI.updateUserRole(user.id, newRole, storeIds)
      await fetchUsers()
      showMessage(`${user.name} → ${ROLE_OPTIONS.find(r => r.value === newRole)?.label}`)
    } catch (err) {
      showMessage('Failed to update role', true)
    } finally {
      setSaving(null)
    }
  }

  const toggleStore = async (user, storeId) => {
    const currentIds = user.managed_stores.map(s => s.id)
    const newIds = currentIds.includes(storeId)
      ? currentIds.filter(id => id !== storeId)
      : [...currentIds, storeId]

    setSaving(user.id)
    try {
      await adminAPI.assignStores(user.id, newIds)
      await fetchUsers()
      showMessage(`Updated stores for ${user.name}`)
    } catch (err) {
      showMessage('Failed to update stores', true)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const allStores = stores.filter(s => s.id !== 'all')
  const filtered = filter === 'ALL' ? users
    : filter === 'MANAGERS' ? users.filter(u => MANAGER_ROLES.includes(u.role))
    : users.filter(u => !MANAGER_ROLES.includes(u.role))

  const managerCount = users.filter(u => MANAGER_ROLES.includes(u.role)).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Assignment</h1>
          <p className="text-gray-500 text-sm mt-1">
            {users.length} staff · {managerCount} manager{managerCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'ALL', label: `All (${users.length})` },
          { key: 'MANAGERS', label: `Managers (${managerCount})` },
          { key: 'EMPLOYEES', label: `Staff (${users.length - managerCount})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          <TeamIcon size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-lg mb-1">No staff found</p>
          <p className="text-sm">Add employees through HR Management first.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const isManager = MANAGER_ROLES.includes(user.role)
            const isExpanded = expandedUser === user.id
            const roleOption = ROLE_OPTIONS.find(r => r.value === user.role)

            return (
              <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* User Row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                    isManager ? 'bg-purple-500' : 'bg-gray-400'
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
                    <p className="text-xs text-gray-400">{user.email} · {user.organization || 'No store'}</p>
                  </div>

                  {/* Role Badge */}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${roleOption?.color || 'bg-gray-100 text-gray-600'}`}>
                    {roleOption?.label || user.role_display}
                  </span>

                  {/* Store count for managers */}
                  {isManager && user.managed_stores.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {user.managed_stores.length} store{user.managed_stores.length !== 1 ? 's' : ''}
                    </span>
                  )}

                  {/* Expand arrow */}
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded Panel */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                    {/* Role Selection */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Role</p>
                      <div className="flex flex-wrap gap-2">
                        {ROLE_OPTIONS.map(role => (
                          <button
                            key={role.value}
                            onClick={() => handleRoleChange(user, role.value)}
                            disabled={saving === user.id || user.role === role.value}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                              user.role === role.value
                                ? `${role.color} ring-2 ring-offset-1 ring-current`
                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                            } ${saving === user.id ? 'opacity-50' : ''}`}
                          >
                            {role.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Store Assignment (only for managers) */}
                    {MANAGER_ROLES.includes(user.role) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Managed Stores</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {allStores.map(store => {
                            const isAssigned = user.managed_stores.some(s => s.id === store.id)
                            return (
                              <button
                                key={store.id}
                                onClick={() => toggleStore(user, store.id)}
                                disabled={saving === user.id}
                                className={`flex items-center gap-2 p-3 rounded-lg border text-sm text-left transition-all ${
                                  isAssigned
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                } ${saving === user.id ? 'opacity-50' : ''}`}
                              >
                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                                  isAssigned ? 'bg-blue-500 text-white' : 'border border-gray-300'
                                }`}>
                                  {isAssigned && <span className="text-xs">✓</span>}
                                </div>
                                <HomeIcon size={14} className="shrink-0" />
                                <span className="truncate">{store.name}</span>
                              </button>
                            )
                          })}
                        </div>
                        {allStores.length === 0 && (
                          <p className="text-sm text-gray-400">No stores available</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

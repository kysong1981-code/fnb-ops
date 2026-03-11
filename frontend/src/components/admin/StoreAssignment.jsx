import { useState, useEffect } from 'react'
import { adminAPI } from '../../services/api'
import { useStore } from '../../context/StoreContext'

export default function StoreAssignment() {
  const { stores } = useStore()
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchManagers()
  }, [])

  const fetchManagers = async () => {
    try {
      const res = await adminAPI.getManagerStores()
      setManagers(res.data)
    } catch (err) {
      console.error('Failed to load managers', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleStore = async (manager, storeId) => {
    const currentIds = manager.managed_stores.map(s => s.id)
    const newIds = currentIds.includes(storeId)
      ? currentIds.filter(id => id !== storeId)
      : [...currentIds, storeId]

    setSaving(manager.id)
    try {
      await adminAPI.assignStores(manager.id, newIds)
      await fetchManagers()
      setMessage(`Updated stores for ${manager.name}`)
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage('Failed to update stores')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>

  const allStores = stores.filter(s => s.id !== 'all')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Store Assignment</h1>
      <p className="text-gray-500 mb-6">Assign stores to Enterprise and Area Managers</p>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
          {message}
        </div>
      )}

      {managers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          <p className="text-lg mb-2">No Enterprise or Area Managers found</p>
          <p className="text-sm">Create users with Enterprise Manager or Area Manager roles in HR Management first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {managers.map(manager => (
            <div key={manager.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{manager.name}</h3>
                  <span className="text-sm px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    {manager.role_display}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {manager.managed_stores.length} store{manager.managed_stores.length !== 1 ? 's' : ''} assigned
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allStores.map(store => {
                  const isAssigned = manager.managed_stores.some(s => s.id === store.id)
                  return (
                    <button
                      key={store.id}
                      onClick={() => toggleStore(manager, store.id)}
                      disabled={saving === manager.id}
                      className={`p-3 rounded-lg border text-sm text-left transition-all ${
                        isAssigned
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      } ${saving === manager.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded flex items-center justify-center ${
                          isAssigned ? 'bg-blue-500 text-white' : 'border border-gray-300'
                        }`}>
                          {isAssigned && <span className="text-xs">✓</span>}
                        </div>
                        {store.name}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

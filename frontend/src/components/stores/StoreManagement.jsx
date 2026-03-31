import { useState, useEffect } from 'react'
import { storeAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { BuildingIcon, HomeIcon, EditIcon, TrashIcon, PlusIcon, XIcon } from '../icons'

const NZ_REGIONS = [
  { value: '', label: 'No region' },
  { value: 'AUCKLAND', label: 'Auckland' },
  { value: 'WELLINGTON', label: 'Wellington' },
  { value: 'CANTERBURY', label: 'Canterbury' },
  { value: 'OTAGO', label: 'Otago' },
  { value: 'WAIKATO', label: 'Waikato' },
  { value: 'BAY_OF_PLENTY', label: 'Bay of Plenty' },
  { value: 'HAWKES_BAY', label: "Hawke's Bay" },
  { value: 'TARANAKI', label: 'Taranaki' },
  { value: 'MANAWATU_WHANGANUI', label: 'Manawatu-Whanganui' },
  { value: 'NELSON', label: 'Nelson' },
  { value: 'MARLBOROUGH', label: 'Marlborough' },
  { value: 'WEST_COAST', label: 'West Coast' },
  { value: 'SOUTHLAND', label: 'Southland' },
  { value: 'NORTHLAND', label: 'Northland' },
  { value: 'GISBORNE', label: 'Gisborne' },
  { value: 'CHATHAM_ISLANDS', label: 'Chatham Islands' },
]

const EMPTY_FORM = { name: '', region: '', opening_time: '', closing_time: '', parent: '' }

export default function StoreManagement() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // create | edit | add-sub
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const isCEO = user?.role === 'CEO' || user?.role === 'HQ' || user?.role === 'ADMIN'

  useEffect(() => {
    if (!isCEO) {
      navigate('/dashboard')
      return
    }
    fetchStores()
  }, [])

  const fetchStores = async () => {
    try {
      const res = await storeAPI.getStores()
      const data = res.data?.results || res.data
      setStores(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load stores', err)
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (msg, isError = false) => {
    setMessage({ text: msg, isError })
    setTimeout(() => setMessage(null), 3000)
  }

  // Build tree structure
  const buildTree = () => {
    const companies = []
    const standalone = []
    const subStoreIds = new Set()

    // Identify companies (stores with sub_stores)
    stores.forEach(s => {
      if (s.sub_stores && s.sub_stores.length > 0) {
        s.sub_stores.forEach(sub => subStoreIds.add(sub.id))
      }
    })

    stores.forEach(s => {
      if (s.sub_stores && s.sub_stores.length > 0) {
        companies.push(s)
      } else if (!subStoreIds.has(s.id)) {
        standalone.push(s)
      }
    })

    return { companies, standalone }
  }

  const openCreateModal = (parentId = null) => {
    setForm({ ...EMPTY_FORM, parent: parentId || '' })
    setModalMode(parentId ? 'add-sub' : 'create')
    setEditingId(null)
    setError('')
    setModalOpen(true)
  }

  const openEditModal = (store) => {
    setForm({
      name: store.name || '',
      region: store.region || '',
      opening_time: store.opening_time || '',
      closing_time: store.closing_time || '',
      parent: store.parent || '',
    })
    setEditingId(store.id)
    setModalMode('edit')
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Store name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (modalMode === 'edit') {
        await storeAPI.updateStore(editingId, {
          name: form.name.trim(),
          region: form.region,
          opening_time: form.opening_time || null,
          closing_time: form.closing_time || null,
          parent: form.parent || null,
        })
        showMessage(`"${form.name.trim()}" updated`)
      } else {
        await storeAPI.createStore({
          name: form.name.trim(),
          region: form.region,
          opening_time: form.opening_time || null,
          closing_time: form.closing_time || null,
          parent: form.parent || null,
        })
        showMessage(`"${form.name.trim()}" created`)
      }
      setModalOpen(false)
      setForm({ ...EMPTY_FORM })
      await fetchStores()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save store')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await storeAPI.deleteStore(id)
      setDeleteConfirm(null)
      showMessage('Store deleted')
      await fetchStores()
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to delete store', true)
      setDeleteConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  // Get companies (stores that can be parents) for the parent dropdown
  const parentOptions = stores.filter(s => s.sub_stores && s.sub_stores.length > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const { companies, standalone } = buildTree()

  const getRegionLabel = (val) => NZ_REGIONS.find(r => r.value === val)?.label || ''

  const renderStoreRow = (store, isSubStore = false, isLast = false) => {
    const fullStore = stores.find(s => s.id === store.id) || store
    return (
      <div
        key={store.id}
        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition ${
          isSubStore ? 'pl-10' : ''
        }`}
      >
        {isSubStore && (
          <span className="text-gray-300 text-sm font-mono">{isLast ? '\u2514' : '\u251C'}</span>
        )}
        <HomeIcon size={16} className={isSubStore ? 'text-gray-400' : 'text-blue-500'} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800 text-sm">{store.name}</p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {fullStore.region && <span>{getRegionLabel(fullStore.region)}</span>}
            {fullStore.opening_time && fullStore.closing_time && (
              <span>{fullStore.opening_time?.slice(0,5)} - {fullStore.closing_time?.slice(0,5)}</span>
            )}
            {!isSubStore && (!fullStore.sub_stores || fullStore.sub_stores.length === 0) && (
              <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">Standalone</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditModal(fullStore)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            title="Edit"
          >
            <EditIcon size={14} />
          </button>
          <button
            onClick={() => setDeleteConfirm(store)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
            title="Delete"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            {stores.length} store{stores.length !== 1 ? 's' : ''} total
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

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => openCreateModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
        >
          <PlusIcon size={16} />
          Create Company
        </button>
        <button
          onClick={() => {
            setForm({ ...EMPTY_FORM })
            setModalMode('create')
            setEditingId(null)
            setError('')
            setModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
        >
          <PlusIcon size={16} />
          Create Standalone Store
        </button>
      </div>

      {/* Store tree */}
      {stores.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          <BuildingIcon size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-lg mb-1">No stores yet</p>
          <p className="text-sm">Create your first company or standalone store above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Companies with sub-stores */}
          {companies.map(company => (
            <div key={company.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Company header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50/50 border-b border-gray-100">
                <BuildingIcon size={16} className="text-blue-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{company.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium">Company</span>
                    <span>{company.sub_stores.length} sub-store{company.sub_stores.length !== 1 ? 's' : ''}</span>
                    {company.region && <span>{getRegionLabel(company.region)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openCreateModal(company.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition"
                    title="Add sub-store"
                  >
                    <PlusIcon size={12} />
                    Add Sub-store
                  </button>
                  <button
                    onClick={() => openEditModal(company)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                    title="Edit"
                  >
                    <EditIcon size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(company)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                    title="Delete"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
              {/* Sub-stores */}
              {company.sub_stores.map((sub, idx) =>
                renderStoreRow(sub, true, idx === company.sub_stores.length - 1)
              )}
            </div>
          ))}

          {/* Standalone stores */}
          {standalone.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {standalone.length > 0 && companies.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Standalone Stores</p>
                </div>
              )}
              <div className="divide-y divide-gray-50">
                {standalone.map(store => renderStoreRow(store))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800">
                {modalMode === 'edit' ? 'Edit Store' : modalMode === 'add-sub' ? 'Add Sub-store' : 'Create Store'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <XIcon size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Store Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); setError('') }}
                  placeholder="e.g. Hikari Sushi Train"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Region */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Region</label>
                <select
                  value={form.region}
                  onChange={e => setForm({ ...form, region: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {NZ_REGIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Operating Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={form.opening_time}
                    onChange={e => setForm({ ...form, opening_time: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={form.closing_time}
                    onChange={e => setForm({ ...form, closing_time: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Parent (only show for edit mode or standalone create, not for add-sub) */}
              {modalMode === 'edit' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Parent Company</label>
                  <select
                    value={form.parent}
                    onChange={e => setForm({ ...form, parent: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">None (Standalone)</option>
                    {stores.filter(s => s.id !== editingId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {modalMode === 'add-sub' && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-600">
                  This store will be added as a sub-store of{' '}
                  <span className="font-semibold">{stores.find(s => s.id === Number(form.parent))?.name || 'selected company'}</span>
                </div>
              )}
            </div>

            {error && <p className="text-red-500 text-xs mt-3">{error}</p>}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Store</h3>
            <p className="text-sm text-gray-500 mb-1">
              Are you sure you want to delete <span className="font-semibold text-gray-700">{deleteConfirm.name}</span>?
            </p>
            <p className="text-xs text-red-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { safetyAPI } from '../../services/api'
import { getTodayNZ } from '../../utils/date'
import { useStore } from '../../context/StoreContext'
import api from '../../services/api'
import { XIcon, CheckCircleIcon } from '../icons'

/**
 * Inline modal for daily cleaning — same UX as SafetyRecordForm
 * Replaces full-page CleaningForm navigation
 */
export default function InlineCleaningForm({ onComplete, onClose }) {
  const { selectedStore } = useStore()
  const storeParams = selectedStore ? { store_id: selectedStore.id } : {}

  const [areas, setAreas] = useState([])
  const [selectedAreas, setSelectedAreas] = useState([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await safetyAPI.getCleaningAreas(storeParams)
        const activeAreas = (Array.isArray(res.data) ? res.data : res.data.results || [])
          .filter(a => a.is_active)
        setAreas(activeAreas)
      } catch (err) {
        console.error('Failed to load cleaning areas:', err)
        setError('Failed to load cleaning areas')
      } finally {
        setLoading(false)
      }
    }
    fetchAreas()
  }, [])

  const toggleArea = (areaName) => {
    setSelectedAreas(prev =>
      prev.includes(areaName)
        ? prev.filter(a => a !== areaName)
        : [...prev, areaName]
    )
  }

  const allSelected = areas.length > 0 && selectedAreas.length === areas.length

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedAreas([])
    } else {
      setSelectedAreas(areas.map(a => a.name))
    }
  }

  const handleSubmit = async () => {
    if (selectedAreas.length === 0) return

    setSaving(true)
    setError('')

    try {
      const dateStr = getTodayNZ()

      // Save cleaning record
      await api.post('/safety/cleaning/', {
        date: dateStr,
        area: selectedAreas.join(', '),
        notes: notes,
        is_completed: true,
      }, { params: storeParams })

      // Also mark the safety task as complete
      try {
        await safetyAPI.quickComplete({
          record_type: 'daily_cleaning',
          data: { areas: selectedAreas },
          notes: notes,
        }, storeParams)
      } catch (e) {
        console.warn('Could not mark safety task complete:', e)
      }

      onComplete()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save cleaning record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Daily Cleaning</h2>
            <p className="text-xs text-gray-400">
              일일 청소 · {selectedAreas.length}/{areas.length} areas selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
          >
            <XIcon size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading cleaning areas...</div>
          ) : areas.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No cleaning areas registered.</p>
              <p className="text-sm text-gray-400 mt-1">Add cleaning areas in Store Settings first.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Select All */}
              {areas.length > 3 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={`w-full py-2 px-4 rounded-xl text-sm font-medium border transition-colors ${
                    allSelected
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {allSelected ? '✓ All Selected' : 'Select All Areas'}
                </button>
              )}

              {/* Area checkboxes */}
              {areas.map(area => {
                const isSelected = selectedAreas.includes(area.name)
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => toggleArea(area.name)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'bg-emerald-500 text-white' : 'bg-gray-100 border border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${isSelected ? 'text-emerald-800 font-medium' : 'text-gray-700'}`}>
                      {area.name}
                    </span>
                  </button>
                )
              })}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Notes / 비고
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  rows={2}
                  placeholder="Cleaning supplies used, special notes..."
                />
              </div>
            </>
          )}
        </div>

        {/* Submit button — fixed at bottom */}
        {areas.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl">
            <button
              onClick={handleSubmit}
              disabled={saving || selectedAreas.length === 0}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white font-bold rounded-xl text-base transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CheckCircleIcon size={20} />
              {saving ? 'Saving...' : `Complete (${selectedAreas.length}/${areas.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

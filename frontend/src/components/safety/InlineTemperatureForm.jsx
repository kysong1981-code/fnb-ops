import { useState, useEffect } from 'react'
import { safetyAPI } from '../../services/api'
import { getTodayNZ } from '../../utils/date'
import { useStore } from '../../context/StoreContext'
import { XIcon, CheckCircleIcon } from '../icons'

/**
 * Inline modal for daily temperature check — same UX as SafetyRecordForm
 * Replaces full-page TemperatureForm navigation
 */
export default function InlineTemperatureForm({ onComplete, onClose }) {
  const { selectedStore } = useStore()
  const storeParams = selectedStore && selectedStore.id !== 'all' ? { store_id: selectedStore.id } : {}

  const [locations, setLocations] = useState([])
  const [readings, setReadings] = useState({})
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await safetyAPI.getTemperatureLocations(storeParams)
        setLocations(res.data)
        const initial = {}
        res.data.forEach(loc => { initial[loc.id] = '' })
        setReadings(initial)
      } catch (err) {
        console.error('Failed to fetch temperature locations:', err)
        setError('Failed to load equipment list')
      } finally {
        setLoading(false)
      }
    }
    fetchLocations()
  }, [])

  const getStatus = (temp, loc) => {
    if (temp === '' || temp === null || isNaN(parseFloat(temp))) return null
    const t = parseFloat(temp)
    const min = parseFloat(loc.standard_min)
    const max = parseFloat(loc.standard_max)
    if (t >= min && t <= max) return 'normal'
    const diff = t < min ? min - t : t - max
    if (diff <= 2) return 'warning'
    return 'critical'
  }

  const statusStyle = {
    normal: 'border-emerald-300 bg-emerald-50',
    warning: 'border-amber-300 bg-amber-50',
    critical: 'border-red-300 bg-red-50',
  }

  const statusLabel = {
    normal: { text: 'OK', color: 'text-emerald-600' },
    warning: { text: 'Warning', color: 'text-amber-600' },
    critical: { text: 'Critical', color: 'text-red-600' },
  }

  const handleSubmit = async () => {
    const hasEmpty = locations.some(loc => !readings[loc.id] && readings[loc.id] !== 0)
    if (hasEmpty) {
      setError('Please enter temperature for all equipment')
      return
    }

    setSaving(true)
    setError('')

    try {
      const now = new Date()
      const timeStr = now.toTimeString().slice(0, 5)
      const dateStr = getTodayNZ()

      // Save each temperature record
      const promises = locations.map(loc =>
        safetyAPI.createTemperatureRecord({
          location: loc.name,
          temperature: parseFloat(readings[loc.id]),
          standard_temperature: loc.standard_max,
          date: dateStr,
          time: timeStr,
          notes: notes,
        }, storeParams)
      )
      await Promise.all(promises)

      // Also mark the safety task as complete
      try {
        await safetyAPI.quickComplete({
          record_type: 'daily_temperature',
          data: { readings: Object.fromEntries(locations.map(loc => [loc.name, parseFloat(readings[loc.id])])) },
          notes: notes,
        }, storeParams)
      } catch (e) {
        console.warn('Could not mark safety task complete:', e)
      }

      onComplete()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save temperature records')
    } finally {
      setSaving(false)
    }
  }

  const filledCount = locations.filter(loc => readings[loc.id] !== '' && readings[loc.id] !== undefined).length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Daily Temperature Check</h2>
            <p className="text-xs text-gray-400">
              일일 온도 체크 · {filledCount}/{locations.length} recorded
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
            <div className="text-center py-8 text-gray-400">Loading equipment...</div>
          ) : locations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No equipment registered for this store.</p>
              <p className="text-sm text-gray-400 mt-1">Add equipment in Store Settings first.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {locations.map(loc => {
                const status = getStatus(readings[loc.id], loc)
                const borderClass = status ? statusStyle[status] : 'border-gray-200 bg-white'

                return (
                  <div key={loc.id} className={`rounded-xl p-3 border-2 ${borderClass}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{loc.name}</p>
                        <p className="text-xs text-gray-400">
                          {loc.standard_min}°C ~ {loc.standard_max}°C
                        </p>
                      </div>
                      {status && (
                        <span className={`text-xs font-bold ${statusLabel[status].color}`}>
                          {statusLabel[status].text}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={readings[loc.id] || ''}
                        onChange={(e) => setReadings(prev => ({ ...prev, [loc.id]: e.target.value }))}
                        placeholder="Enter °C"
                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-base font-semibold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                      <span className="text-gray-400 text-sm font-medium">°C</span>
                    </div>
                  </div>
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
                  placeholder="Any issues or observations..."
                />
              </div>
            </>
          )}
        </div>

        {/* Submit button — fixed at bottom */}
        {locations.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl">
            <button
              onClick={handleSubmit}
              disabled={saving || filledCount === 0}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white font-bold rounded-xl text-base transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CheckCircleIcon size={20} />
              {saving ? 'Saving...' : `Save All (${filledCount}/${locations.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

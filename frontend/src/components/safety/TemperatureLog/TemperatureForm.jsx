import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { safetyAPI } from '../../../services/api'
import { getTodayNZ } from '../../../utils/date'
import { useStore } from '../../../context/StoreContext'
import Card from '../../ui/Card'

export default function TemperatureForm() {
  const navigate = useNavigate()
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
        // Initialize readings for each location
        const initial = {}
        res.data.forEach(loc => {
          initial[loc.id] = ''
        })
        setReadings(initial)
      } catch (err) {
        console.error('Failed to fetch temperature locations:', err)
        setError('Failed to load equipment list')
      } finally {
        setLoading(false)
      }
    }
    fetchLocations()
  }, [selectedStore])

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
    // Check all locations have readings
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
        // Non-critical - task completion is nice-to-have
        console.warn('Could not mark safety task complete:', e)
      }

      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save temperature records')
    } finally {
      setSaving(false)
    }
  }

  const filledCount = locations.filter(loc => readings[loc.id] !== '' && readings[loc.id] !== undefined).length

  if (loading) {
    return (
      <div className="p-4">
        <Card className="p-5 text-center text-gray-400">Loading equipment...</Card>
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Daily Temperature Check</h1>
        </div>
        <Card className="p-5 text-center">
          <p className="text-gray-500">No equipment registered for this store.</p>
          <p className="text-sm text-gray-400 mt-1">Add equipment in Store Settings first.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Daily Temperature Check</h1>
          <p className="text-sm text-gray-400">{filledCount}/{locations.length} recorded</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Equipment cards */}
      {locations.map(loc => {
        const status = getStatus(readings[loc.id], loc)
        const borderClass = status ? statusStyle[status] : 'border-gray-200 bg-white'

        return (
          <Card key={loc.id} className={`p-4 border-2 ${borderClass}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">{loc.name}</p>
                <p className="text-xs text-gray-400">
                  Range: {loc.standard_min}°C ~ {loc.standard_max}°C
                </p>
              </div>
              {status && (
                <span className={`text-sm font-bold ${statusLabel[status].color}`}>
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
                className="flex-1 px-3 py-3 border border-gray-300 rounded-xl text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-400 text-lg font-medium">°C</span>
            </div>
          </Card>
        )
      })}

      {/* Notes */}
      <Card className="p-4">
        <label className="block text-sm font-medium text-gray-500 mb-2">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows="2"
          placeholder="Any issues or observations..."
          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </Card>

      {/* Submit button - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
        <button
          onClick={handleSubmit}
          disabled={saving || filledCount === 0}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {saving ? 'Saving...' : `Save All (${filledCount}/${locations.length})`}
        </button>
      </div>
    </div>
  )
}

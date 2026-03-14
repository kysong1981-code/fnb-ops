import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { salesAnalysisAPI } from '../../services/api'
import { getTodayNZ } from '../../utils/date'
import Card from '../ui/Card'
import StoreAnalysis from './StoreAnalysis'
import CompareView from './CompareView'

/* ── Date helpers ─────────────────────────────────────────── */

const DATE_MODES = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'custom', label: 'Custom' },
]

function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { start: localDateStr(mon), end: localDateStr(sun) }
}

function getMonthRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: localDateStr(start), end: localDateStr(end) }
}

/* ── Main Component ──────────────────────────────────────── */

export default function SalesAnalysis() {
  const { user } = useAuth()
  const role = user?.role || 'MANAGER'

  // State
  const [activeTab, setActiveTab] = useState('store') // 'store' | 'compare'
  const [dateMode, setDateMode] = useState('month')
  const [date, setDate] = useState(getTodayNZ())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Store selector
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')

  // Fetch accessible stores
  useEffect(() => {
    salesAnalysisAPI.getAccessibleStores()
      .then((res) => setStores(res.data || []))
      .catch(() => setStores([]))
  }, [])

  // Compute date range
  const { startDate, endDate } = useMemo(() => {
    if (dateMode === 'custom') {
      return { startDate: customStart, endDate: customEnd }
    }
    if (dateMode === 'week') {
      const { start, end } = getWeekRange(date)
      return { startDate: start, endDate: end }
    }
    const { start, end } = getMonthRange(date)
    return { startDate: start, endDate: end }
  }, [dateMode, date, customStart, customEnd])

  const getRangeLabel = () => {
    if (dateMode === 'week') {
      const { start, end } = getWeekRange(date)
      const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const e = new Date(end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `${s} — ${e}`
    }
    if (dateMode === 'month') {
      const d = new Date(date + 'T00:00:00')
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    }
    return null
  }

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Tab: Store / Compare */}
          <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
            <button
              onClick={() => setActiveTab('store')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'store' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Store Analysis
            </button>
            {stores.length > 1 && (
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'compare' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Compare Stores
              </button>
            )}
          </div>

          {/* Date mode */}
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
              {DATE_MODES.map((dm) => (
                <button
                  key={dm.key}
                  onClick={() => setDateMode(dm.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    dateMode === dm.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {dm.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date inputs + Store selector */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
          {dateMode === 'custom' ? (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={inputCls} />
              <span className="text-gray-400 text-sm">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={inputCls} />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">{getRangeLabel()}</span>
            </div>
          )}

          {/* Store selector (only in Store Analysis tab) */}
          {activeTab === 'store' && stores.length > 1 && (
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className={`${inputCls} min-w-[180px]`}
            >
              <option value="">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {/* Content */}
      {startDate && endDate && (
        activeTab === 'compare' ? (
          <CompareView
            startDate={startDate}
            endDate={endDate}
            stores={stores}
          />
        ) : (
          <StoreAnalysis
            startDate={startDate}
            endDate={endDate}
            organizationId={selectedStoreId || undefined}
          />
        )
      )}
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { salesAnalysisAPI } from '../../services/api'
import Card from '../ui/Card'
import StoreAnalysis from './StoreAnalysis'
import RegionalAnalysis from './RegionalAnalysis'
import EnterpriseAnalysis from './EnterpriseAnalysis'

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

/* ── Role → View mapping ─────────────────────────────────── */

const ROLE_VIEWS = {
  EMPLOYEE: ['store'],
  MANAGER: ['store'],
  SENIOR_MANAGER: ['store'],
  REGIONAL_MANAGER: ['regional', 'store'],
  HQ: ['enterprise', 'regional', 'store'],
  CEO: ['enterprise', 'regional', 'store'],
  ADMIN: ['enterprise', 'regional', 'store'],
}

const MULTI_STORE_ROLES = ['REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN']

const VIEW_LABELS = {
  enterprise: 'Enterprise',
  regional: 'Regional',
  store: 'Store',
}

/* ── Main Component ──────────────────────────────────────── */

export default function SalesAnalysis() {
  const { user } = useAuth()
  const role = user?.role || 'MANAGER'

  // Available views based on role
  const availableViews = ROLE_VIEWS[role] || ['store']
  const defaultView = availableViews[0]
  const canSelectStore = MULTI_STORE_ROLES.includes(role)

  // State
  const [activeView, setActiveView] = useState(defaultView)
  const [dateMode, setDateMode] = useState('month')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Drill-down state
  const [drillView, setDrillView] = useState(null)
  const [breadcrumbs, setBreadcrumbs] = useState([])

  // Store selector state (for multi-store roles on Store tab)
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')

  // Fetch accessible stores for store selector
  useEffect(() => {
    if (canSelectStore) {
      salesAnalysisAPI.getAccessibleStores()
        .then((res) => setStores(res.data || []))
        .catch(() => setStores([]))
    }
  }, [canSelectStore])

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

  // Drill-down handler
  const handleDrillDown = (view, id) => {
    setBreadcrumbs((prev) => [
      ...prev,
      { view: drillView ? drillView.view : activeView, id: drillView?.id },
    ])
    setDrillView({ view, id })
  }

  // Breadcrumb back
  const handleBack = () => {
    if (breadcrumbs.length > 0) {
      const prev = breadcrumbs[breadcrumbs.length - 1]
      setBreadcrumbs((bc) => bc.slice(0, -1))
      if (prev.view === activeView && !prev.id) {
        setDrillView(null)
      } else {
        setDrillView(prev.id ? { view: prev.view, id: prev.id } : null)
      }
    } else {
      setDrillView(null)
    }
  }

  const handleViewChange = (view) => {
    setActiveView(view)
    setDrillView(null)
    setBreadcrumbs([])
    setSelectedStoreId('')
  }

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  // Determine which component to render
  const renderView = () => {
    const currentView = drillView?.view || activeView

    if (currentView === 'store') {
      return (
        <StoreAnalysis
          startDate={startDate}
          endDate={endDate}
          organizationId={drillView?.id || selectedStoreId || undefined}
        />
      )
    }

    if (currentView === 'regional') {
      return (
        <RegionalAnalysis
          startDate={startDate}
          endDate={endDate}
          regionId={drillView?.id}
          onDrillDown={handleDrillDown}
        />
      )
    }

    if (currentView === 'enterprise') {
      return (
        <EnterpriseAnalysis
          startDate={startDate}
          endDate={endDate}
          onDrillDown={handleDrillDown}
        />
      )
    }

    return null
  }

  // Show store selector when on Store tab with multi-store role (and not in drill-down)
  const showStoreSelector = canSelectStore && activeView === 'store' && !drillView && stores.length > 1

  return (
    <div className="space-y-6">
      {/* Header: View tabs + Date controls */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* View tabs (if multiple views available) */}
          {availableViews.length > 1 && !drillView && (
            <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
              {availableViews.map((view) => (
                <button
                  key={view}
                  onClick={() => handleViewChange(view)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    activeView === view
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  {VIEW_LABELS[view]}
                </button>
              ))}
            </div>
          )}

          {/* Drill-down breadcrumb */}
          {drillView && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <span className="text-xs text-gray-400">
                {VIEW_LABELS[activeView]}
                {breadcrumbs.map((bc, i) => (
                  <span key={i}> → {VIEW_LABELS[bc.view]}</span>
                ))}
                {' → '}
                <span className="font-semibold text-gray-600">{VIEW_LABELS[drillView.view]}</span>
              </span>
            </div>
          )}

          {/* Date mode selector */}
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
              {DATE_MODES.map((dm) => (
                <button
                  key={dm.key}
                  onClick={() => setDateMode(dm.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    dateMode === dm.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500'
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
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className={inputCls}
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={inputCls}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                {getRangeLabel()}
              </span>
            </div>
          )}

          {/* Store selector dropdown */}
          {showStoreSelector && (
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className={`${inputCls} min-w-[180px]`}
            >
              <option value="">My Store</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {/* View content */}
      {startDate && endDate && renderView()}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { reportsAPI } from '../../services/api'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import { ChartIcon } from '../icons'
import DailyStoreReport from './DailyStoreReport'
import DailyCharts from './DailyCharts'
import StoreComparison from './StoreComparison'
import CashReport from './CashReport'
import SalesReport from './SalesReport'
import SupplyReport from './SupplyReport'
import CQReport from './CQReport'

const REGIONAL_ROLES = ['REGIONAL_MANAGER', 'HQ', 'CEO']
const ADMIN_ROLES = ['SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']

const DATE_MODES = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

function getWeekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const sun = new Date(d)
  sun.setDate(d.getDate() - day)
  const sat = new Date(sun)
  sat.setDate(sun.getDate() + 6)
  return {
    start: sun.toISOString().split('T')[0],
    end: sat.toISOString().split('T')[0],
  }
}

function getMonthRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

export default function StoreReport() {
  const { user } = useAuth()
  const [reportType, setReportType] = useState('daily')
  const [dateMode, setDateMode] = useState('day')
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reportData, setReportData] = useState(null)

  // Build tabs based on role
  const isRegional = user && REGIONAL_ROLES.includes(user.role)
  const isAdmin = user && ADMIN_ROLES.includes(user.role)
  const tabs = [
    { key: 'daily', label: 'Daily Report' },
    { key: 'cash', label: 'Cash Report' },
    { key: 'sales', label: 'Sales Report' },
    { key: 'supply', label: 'Supply Report' },
    ...(isRegional ? [{ key: 'comparison', label: 'Store Comparison' }] : []),
    ...(isAdmin ? [{ key: 'cq', label: 'CQ Report' }] : []),
  ]

  useEffect(() => {
    // Only fetch for daily / comparison — others handle their own data
    if (reportType === 'daily' || reportType === 'comparison') {
      fetchReport()
    }
  }, [reportType, selectedDate, dateMode])

  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      let response
      if (reportType === 'daily') {
        response = await reportsAPI.getDailyStoreReport(selectedDate)
      } else if (reportType === 'comparison') {
        response = await reportsAPI.getStoreComparison(selectedDate)
      }
      setReportData(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  // Build date range label
  const getDateRangeLabel = () => {
    if (dateMode === 'day') return null
    if (dateMode === 'week') {
      const { start, end } = getWeekRange(selectedDate)
      return `${formatShortDate(start)} — ${formatShortDate(end)}`
    }
    if (dateMode === 'month') {
      const d = new Date(selectedDate + 'T00:00:00')
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    }
    return null
  }

  const formatShortDate = (d) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Only show date picker for daily & comparison tabs
  const showDatePicker = reportType === 'daily' || reportType === 'comparison'

  // Self-contained tabs (they handle their own data fetching & controls)
  const isSelfContained = ['cash', 'sales', 'supply', 'cq'].includes(reportType)

  // Compute chart date range for daily tab
  const getChartRange = () => {
    if (dateMode === 'week') return getWeekRange(selectedDate)
    if (dateMode === 'month') return getMonthRange(selectedDate)
    // Day mode: show current week
    return getWeekRange(selectedDate)
  }
  const chartRange = getChartRange()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Reports"
        subtitle="Daily overview, cash flow, sales & supply reports"
        icon={<ChartIcon size={24} />}
      />

      {/* Tab navigation */}
      <Card className="p-4">
        <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setReportData(null); setError(''); setReportType(tab.key); }}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                reportType === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date picker (daily, comparison only) */}
        {showDatePicker && (
          <div className="mt-4 flex flex-wrap items-end gap-4">
            {/* Date mode selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Period
              </label>
              <div className="bg-gray-100 rounded-lg p-0.5 flex gap-0.5">
                {DATE_MODES.map((dm) => (
                  <button
                    key={dm.key}
                    onClick={() => setDateMode(dm.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      dateMode === dm.key
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {dm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date input */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                {dateMode === 'month' ? 'Month' : dateMode === 'week' ? 'Week of' : 'Date'}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>

            {/* Range label */}
            {dateMode !== 'day' && (
              <div className="pb-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                  {getDateRangeLabel()}
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Charts (always shown for daily tab) */}
      {reportType === 'daily' && !isSelfContained && (
        <DailyCharts startDate={chartRange.start} endDate={chartRange.end} />
      )}

      {/* Report content */}
      {isSelfContained ? (
        <>
          {reportType === 'cash' && <CashReport />}
          {reportType === 'sales' && <SalesReport />}
          {reportType === 'supply' && <SupplyReport />}
          {reportType === 'cq' && <CQReport />}
        </>
      ) : loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reportData ? (
        <>
          {reportType === 'daily' && <DailyStoreReport data={reportData} />}
          {reportType === 'comparison' && <StoreComparison data={reportData} />}
        </>
      ) : null}
    </div>
  )
}

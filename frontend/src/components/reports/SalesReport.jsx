import { useState, useEffect } from 'react'
import { reportsAPI, monthlyCloseAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import { getTodayNZ } from '../../utils/date'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'
import Badge from '../ui/Badge'
import SalesCharts from './SalesCharts'
import AIInsightsCard from './AIInsightsCard'

const DATE_MODES = [
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
]

function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: localDateStr(start), end: localDateStr(end) }
}

const SENIOR_ROLES = ['SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN']

export default function SalesReport() {
  const { user } = useAuth()
  const { stores } = useStore()
  const [dateMode, setDateMode] = useState('month')
  const [date, setDate] = useState(getTodayNZ())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Store selector
  const [viewMode, setViewMode] = useState('single') // 'single' | 'all'
  const [selectedStoreId, setSelectedStoreId] = useState(null)

  // Data
  const [singleData, setSingleData] = useState(null)
  const [multiData, setMultiData] = useState(null)
  const [chartData, setChartData] = useState([])

  // Monthly close
  const [monthClosed, setMonthClosed] = useState(false)
  const [closingAction, setClosingAction] = useState(false)

  const isSenior = user && SENIOR_ROLES.includes(user.role)

  // Get current date range
  const getRange = () => {
    if (dateMode === 'month') return getMonthRange(date)
    if (dateMode === 'year') {
      const y = new Date(date + 'T00:00:00').getFullYear()
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
    if (dateMode === 'custom' && startDate && endDate) return { start: startDate, end: endDate }
    return null
  }

  // Fetch data when dates or store changes
  useEffect(() => {
    const range = getRange()
    if (!range) return
    fetchData(range)
  }, [date, startDate, endDate, dateMode, viewMode, selectedStoreId])

  // Monthly close check
  useEffect(() => {
    if (dateMode === 'month') {
      const d = new Date(date + 'T00:00:00')
      checkMonthClose(d.getFullYear(), d.getMonth() + 1)
    } else {
      setMonthClosed(false)
    }
  }, [date, dateMode])

  const fetchData = async (range) => {
    setLoading(true)
    setError('')
    try {
      if (viewMode === 'all' && isSenior) {
        // Multi-store
        const res = await reportsAPI.getMultiStoreSales(range.start, range.end)
        setMultiData(res.data)
        setSingleData(null)
      } else {
        // Single store
        const [salesRes, chartRes] = await Promise.all([
          reportsAPI.getSalesReportRange(range.start, range.end),
          reportsAPI.getChartData(range.start, range.end),
        ])
        setSingleData(salesRes.data)
        setChartData(chartRes.data.days || [])
        setMultiData(null)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sales report.')
    } finally {
      setLoading(false)
    }
  }

  const checkMonthClose = async (year, month) => {
    try {
      const res = await monthlyCloseAPI.summary(year, month)
      setMonthClosed(res.data.monthly_close?.status === 'CLOSED')
    } catch { setMonthClosed(false) }
  }

  const handleCloseMonth = async () => {
    const d = new Date(date + 'T00:00:00')
    setClosingAction(true)
    try {
      await monthlyCloseAPI.closeMonth({ year: d.getFullYear(), month: d.getMonth() + 1 })
      setMonthClosed(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close month.')
    } finally { setClosingAction(false) }
  }

  const handleReopenMonth = async () => {
    const d = new Date(date + 'T00:00:00')
    setClosingAction(true)
    try {
      await monthlyCloseAPI.reopen({ year: d.getFullYear(), month: d.getMonth() + 1 })
      setMonthClosed(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reopen month.')
    } finally { setClosingAction(false) }
  }

  const handleStoreChange = (e) => {
    const val = e.target.value
    if (val === 'all') {
      setViewMode('all')
      setSelectedStoreId(null)
    } else {
      setViewMode('single')
      setSelectedStoreId(val || null)
    }
  }

  const fmt = (v) =>
    `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const fmtDate = (d) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch { return d }
  }

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  const getRangeLabel = () => {
    if (dateMode === 'month') {
      const d = new Date(date + 'T00:00:00')
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    }
    if (dateMode === 'year') {
      return `${new Date(date + 'T00:00:00').getFullYear()}`
    }
    return null
  }

  const range = getRange()

  // Compute display data for single store
  const stats = singleData?.statistics
  const dayOfWeekData = singleData?.data ? computeDayOfWeek(singleData.data) : []
  const salesSummary = singleData ? {
    total_sales: stats?.total_sales || 0,
    card_total: stats?.card_total || singleData.data?.reduce((s, d) => s + parseFloat(d.card_sales || 0), 0) || 0,
    cash_total: stats?.cash_total || singleData.data?.reduce((s, d) => s + parseFloat(d.cash_sales || 0), 0) || 0,
    other_total: stats?.other_total || singleData.data?.reduce((s, d) => s + parseFloat(d.other_sales || 0), 0) || 0,
  } : null

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Date Mode */}
          <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
            {DATE_MODES.map((dm) => (
              <button
                key={dm.key}
                onClick={() => setDateMode(dm.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  dateMode === dm.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {dm.label}
              </button>
            ))}
          </div>

          {/* Store Selector (Senior only) */}
          {isSenior && stores.length > 1 && (
            <select
              value={viewMode === 'all' ? 'all' : (selectedStoreId || '')}
              onChange={handleStoreChange}
              className={`${inputCls} min-w-[160px]`}
            >
              <option value="">My Store</option>
              <option value="all">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Month lock badge */}
          {dateMode === 'month' && monthClosed && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold ml-auto">
              🔒 Month Locked
            </span>
          )}
        </div>

        {dateMode === 'custom' ? (
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
              {getRangeLabel()}
            </span>
          </div>
        )}
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* === SINGLE STORE VIEW === */}
      {!loading && singleData && viewMode === 'single' && (
        <>
          {/* KPI Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Revenue" value={fmt(stats.total_sales)} sub={`POS: ${fmt((stats.card_total || 0) + (stats.cash_total || 0))}${stats.other_total > 0 ? ` + Other: ${fmt(stats.other_total)}` : ''}`} />
            <KpiCard label="Daily Average" value={fmt(stats.average_daily)} />
            <KpiCard
              label="Highest"
              value={fmt(stats.highest?.amount)}
              sub={stats.highest?.date ? fmtDate(stats.highest.date) : undefined}
            />
            <KpiCard
              label="Trend"
              value={
                stats.trend === 'up' ? `↑ ${stats.trend_percentage?.toFixed(1) || 0}%`
                : stats.trend === 'down' ? `↓ ${stats.trend_percentage?.toFixed(1) || 0}%`
                : '— Flat'
              }
              alert={stats.trend === 'down' ? 'Declining' : undefined}
            />
          </div>

          {/* Revenue Breakdown */}
          {salesSummary && salesSummary.other_total > 0 && (
            <Card className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Revenue Breakdown</p>
              <div className="h-8 rounded-xl overflow-hidden flex bg-gray-100 mb-3">
                {salesSummary.card_total > 0 && (
                  <div className="bg-gray-900 h-full flex items-center justify-center" style={{ width: `${(salesSummary.card_total / salesSummary.total_sales * 100)}%` }}>
                    {(salesSummary.card_total / salesSummary.total_sales * 100) > 12 && <span className="text-[10px] font-semibold text-white">Card {(salesSummary.card_total / salesSummary.total_sales * 100).toFixed(1)}%</span>}
                  </div>
                )}
                {salesSummary.cash_total > 0 && (
                  <div className="bg-emerald-500 h-full flex items-center justify-center" style={{ width: `${(salesSummary.cash_total / salesSummary.total_sales * 100)}%` }}>
                    {(salesSummary.cash_total / salesSummary.total_sales * 100) > 8 && <span className="text-[10px] font-semibold text-white">Cash {(salesSummary.cash_total / salesSummary.total_sales * 100).toFixed(1)}%</span>}
                  </div>
                )}
                {salesSummary.other_total > 0 && (
                  <div className="bg-blue-400 h-full flex items-center justify-center" style={{ width: `${(salesSummary.other_total / salesSummary.total_sales * 100)}%` }}>
                    {(salesSummary.other_total / salesSummary.total_sales * 100) > 5 && <span className="text-[10px] font-semibold text-white">Other {(salesSummary.other_total / salesSummary.total_sales * 100).toFixed(1)}%</span>}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-900" /><span className="text-gray-600">Card</span><span className="font-semibold">{fmt(salesSummary.card_total)}</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /><span className="text-gray-600">Cash</span><span className="font-semibold">{fmt(salesSummary.cash_total)}</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-400" /><span className="text-gray-600">Other</span><span className="font-semibold">{fmt(salesSummary.other_total)}</span></div>
              </div>
            </Card>
          )}

          {/* Charts */}
          <SalesCharts
            chartData={chartData}
            salesData={salesSummary}
            dayOfWeekData={dayOfWeekData}
          />

          {/* AI Insights */}
          {range && (
            <AIInsightsCard
              startDate={range.start}
              endDate={range.end}
              storeId={selectedStoreId}
            />
          )}

          {/* Detail Table */}
          <SectionLabel>Detail</SectionLabel>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-900 bg-gray-100">Total</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Card</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Cash</th>
                    <th className="text-right px-3 py-3 font-semibold text-blue-600">Other</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Variance</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {singleData.data.map((item, idx) => {
                    const variance = parseFloat(item.variance || 0)
                    const otherSales = parseFloat(item.other_sales || 0)
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 transition">
                        <td className="px-3 py-2.5 font-medium text-gray-900">
                          {item.date ? fmtDate(item.date) : item.period}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900 bg-gray-50">{fmt(item.actual_total)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.card_sales)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.cash_sales)}</td>
                        <td className="px-3 py-2.5 text-right text-blue-600">{otherSales > 0 ? fmt(otherSales) : '-'}</td>
                        <td className={`px-3 py-2.5 text-right font-medium ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {variance > 0 ? '+' : ''}{fmt(variance)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {item.status === 'APPROVED' ? (
                            <Badge variant="success">Approved</Badge>
                          ) : item.status === 'SUBMITTED' ? (
                            <Badge variant="info">Submitted</Badge>
                          ) : (
                            <Badge variant="neutral">{item.status || 'Draft'}</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                    <td className="px-3 py-2.5 text-gray-900">Total</td>
                    <td className="px-3 py-2.5 text-right text-gray-900 bg-gray-200">{fmt(stats.total_sales)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{fmt(stats.card_total)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{fmt(stats.cash_total)}</td>
                    <td className="px-3 py-2.5 text-right text-blue-700">{fmt(stats.other_total)}</td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5" />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Monthly Close/Lock */}
          {dateMode === 'month' && isSenior && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {monthClosed ? '🔒 Month Closed' : 'Close Month'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {monthClosed ? 'Sales data for this month is locked.' : 'Lock sales data after reconciliation is complete.'}
                  </p>
                </div>
                {monthClosed ? (
                  <button onClick={handleReopenMonth} disabled={closingAction}
                    className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:bg-gray-300 transition">
                    {closingAction ? 'Reopening...' : 'Reopen'}
                  </button>
                ) : (
                  <button onClick={handleCloseMonth} disabled={closingAction}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:bg-gray-300 transition">
                    {closingAction ? 'Closing...' : 'Close & Lock'}
                  </button>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* === ALL STORES VIEW === */}
      {!loading && multiData && viewMode === 'all' && (
        <>
          {/* Combined KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Sales (All)" value={fmt(multiData.combined?.total_sales)} />
            <KpiCard label="Stores" value={multiData.stores?.length || 0} />
            <KpiCard label="Card Total" value={fmt(multiData.combined?.card_total)} />
            <KpiCard label="Cash Total" value={fmt(multiData.combined?.cash_total)} />
          </div>

          {/* Store Ranking Chart */}
          <SectionLabel>Store Comparison</SectionLabel>
          <Card className="p-4">
            <StoreRankingChart stores={multiData.stores || []} />
          </Card>

          {/* Store Detail Table */}
          <SectionLabel>Store Details</SectionLabel>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Store</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Sales</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Daily Avg</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Card</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Cash</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...(multiData.stores || [])].sort((a, b) => b.total_sales - a.total_sales).map((store, idx) => (
                    <tr key={store.store_id} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-300'
                          }`}>{idx + 1}</span>
                          <span className="font-medium text-gray-900">{store.store_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(store.total_sales)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(store.average_daily)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(store.card_total)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(store.cash_total)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-sm font-semibold ${
                          store.trend === 'up' ? 'text-emerald-600' : store.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {store.trend === 'up' ? `↑${store.trend_percentage}%` : store.trend === 'down' ? `↓${Math.abs(store.trend_percentage)}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Day of Week for All Stores */}
          {multiData.combined?.day_of_week_avg && (
            <SalesCharts
              chartData={null}
              salesData={multiData.combined}
              dayOfWeekData={multiData.combined.day_of_week_avg}
            />
          )}

          {/* AI Insights for All Stores */}
          {range && (
            <AIInsightsCard startDate={range.start} endDate={range.end} storeId={null} />
          )}
        </>
      )}
    </div>
  )
}

// Helper: compute day-of-week averages from daily data
function computeDayOfWeek(data) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const map = {}
  dayOrder.forEach(d => { map[d] = [] })

  for (const item of data) {
    if (!item.date) continue
    const dt = new Date(item.date + 'T00:00:00')
    const dayName = dayNames[dt.getDay()]
    map[dayName]?.push(parseFloat(item.actual_total || 0))
  }

  return dayOrder.map(day => ({
    day,
    avg_sales: map[day].length > 0
      ? Math.round(map[day].reduce((a, b) => a + b, 0) / map[day].length)
      : 0,
  }))
}

// Sub-component: horizontal bar chart ranking stores by sales
function StoreRankingChart({ stores }) {
  if (!stores || stores.length === 0) return null

  const sorted = [...stores].sort((a, b) => b.total_sales - a.total_sales)
  const maxSales = sorted[0]?.total_sales || 1

  const fmt = (v) =>
    `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-2">
      {sorted.map((store, idx) => {
        const pct = (store.total_sales / maxSales) * 100
        return (
          <div key={store.store_id} className="flex items-center gap-3">
            <div className="w-28 text-xs font-medium text-gray-600 text-right truncate shrink-0">
              {store.store_name}
            </div>
            <div className="flex-1">
              <div className="bg-gray-100 rounded-full h-8 overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-3 transition-all"
                  style={{
                    width: `${Math.max(pct, 5)}%`,
                    backgroundColor: idx === 0 ? '#3b82f6' : idx === 1 ? '#60a5fa' : '#93c5fd',
                  }}
                >
                  {pct > 20 && (
                    <span className="text-[11px] font-semibold text-white">{fmt(store.total_sales)}</span>
                  )}
                </div>
              </div>
            </div>
            {pct <= 20 && (
              <div className="w-20 text-right shrink-0">
                <span className="text-xs font-semibold text-gray-900">{fmt(store.total_sales)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

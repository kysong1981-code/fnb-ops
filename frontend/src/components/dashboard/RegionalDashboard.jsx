import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { salesAnalysisAPI } from '../../services/api'
import { getTodayNZ } from '../../utils/date'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

/* ── Formatters ─────────────────────────────────────────── */

const fmt = (v) =>
  `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtNum = (v) =>
  parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const fmtDate = (d) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

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

/* ── Custom Tooltip ──────────────────────────────────────── */

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{fmtDate(label)}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gray-600">
          <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: p.color }} />
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

/* ── Main Component ──────────────────────────────────────── */

export default function RegionalDashboard() {
  const { user } = useAuth()

  // Date controls
  const [dateMode, setDateMode] = useState('month')
  const [date, setDate] = useState(getTodayNZ())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Data
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  // Sort
  const [sortKey, setSortKey] = useState('total_sales')
  const [sortAsc, setSortAsc] = useState(false)

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

  // Fetch data
  useEffect(() => {
    if (startDate && endDate) {
      fetchData()
    }
  }, [startDate, endDate])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { start_date: startDate, end_date: endDate }
      const res = await salesAnalysisAPI.getRegionalAnalysis(params)
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const SortIcon = ({ col }) => (
    <span className="ml-0.5 text-[10px] text-gray-400">
      {sortKey === col ? (sortAsc ? '\u2191' : '\u2193') : ''}
    </span>
  )

  const kpis = data?.kpis || {}
  const stores = data?.stores || []
  const dailyTotals = data?.daily_totals || []

  // Sort stores
  const sortedStores = [...stores].sort((a, b) => {
    const av = a[sortKey] || 0
    const bv = b[sortKey] || 0
    return sortAsc ? av - bv : bv - av
  })

  const avgSplh = kpis.splh || 0

  // Chart data - daily totals
  const chartData = dailyTotals.map((item) => ({
    date: item.date,
    label: fmtDate(item.date),
    sales: parseFloat(item.total || 0),
  }))

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  const firstName = user?.user_first_name || user?.user?.first_name || ''

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-1 text-gray-900">
          All Stores Overview
        </h2>
        <p className="text-gray-500 text-sm">Company-wide performance across all stores</p>
      </div>

      {/* Date Controls */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
        </div>
      </Card>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI Cards — Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Sales" value={fmt(kpis.total_sales)} />
            <KpiCard label="SPLH" value={fmt(kpis.splh)} sub="Sales per Labor Hour" />
            <KpiCard
              label="Labor Cost"
              value={fmt(kpis.total_labor_cost)}
              sub={kpis.labor_pct ? `${kpis.labor_pct}% of sales` : undefined}
              alert={kpis.labor_pct > 35 ? 'High' : undefined}
            />
            <KpiCard
              label="vs Prev Period"
              value={`${kpis.change_pct > 0 ? '\u2191' : kpis.change_pct < 0 ? '\u2193' : '\u2014'} ${Math.abs(kpis.change_pct || 0).toFixed(1)}%`}
              sub={kpis.prev_period_total ? `Prev: ${fmt(kpis.prev_period_total)}` : undefined}
              alert={kpis.change_pct < -5 ? 'Declining' : undefined}
            />
          </div>

          {/* KPI Cards — Row 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Stores" value={kpis.store_count || 0} />
            <KpiCard label="Best Store" value={kpis.best_store?.name || '\u2014'} />
            <KpiCard label="Labor Hours" value={fmtNum(kpis.total_labor_hours)} sub={`${kpis.headcount || 0} staff`} />
            <KpiCard label="Avg Ticket" value={fmt(kpis.avg_ticket)} />
          </div>

          {/* Daily Sales Trend Chart */}
          {chartData.length > 0 && (
            <>
              <SectionLabel>Daily Sales Trend</SectionLabel>
              <Card className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}

          {/* Store Comparison Table */}
          {sortedStores.length > 0 && (
            <>
              <SectionLabel>Store Comparison</SectionLabel>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-3 font-semibold text-gray-600">#</th>
                        <th className="text-left px-3 py-3 font-semibold text-gray-600">Store</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('total_sales')}>
                          Sales<SortIcon col="total_sales" />
                        </th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('avg_daily')}>
                          Avg/Day<SortIcon col="avg_daily" />
                        </th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('avg_ticket')}>
                          Avg Ticket<SortIcon col="avg_ticket" />
                        </th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('labor_hours')}>
                          Hrs<SortIcon col="labor_hours" />
                        </th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('splh')}>
                          SPLH<SortIcon col="splh" />
                        </th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('labor_pct')}>
                          Labor%<SortIcon col="labor_pct" />
                        </th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Staff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedStores.map((store, idx) => (
                        <tr key={store.organization?.id || idx} className="hover:bg-gray-50/50 transition">
                          <td className="px-3 py-2.5 text-gray-400 font-medium">{store.rank || idx + 1}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-900">{store.organization?.name}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmt(store.total_sales)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{fmt(store.avg_daily)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{fmt(store.avg_ticket)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-500">{fmtNum(store.labor_hours)}</td>
                          <td className={`px-3 py-2.5 text-right font-medium ${(store.splh || 0) >= avgSplh ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {fmt(store.splh)}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-medium ${(store.labor_pct || 0) > 35 ? 'text-red-600' : 'text-gray-700'}`}>
                            {(store.labor_pct || 0).toFixed(1)}%
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-500">{store.headcount || 0}</td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5 text-gray-900">Total</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.total_sales)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.avg_daily)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.avg_ticket)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{fmtNum(kpis.total_labor_hours)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.splh)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{(kpis.labor_pct || 0).toFixed(1)}%</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{kpis.headcount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {/* SPLH Comparison Bar */}
          {sortedStores.length > 0 && (
            <>
              <SectionLabel>SPLH Comparison</SectionLabel>
              <Card className="p-5">
                <div className="space-y-3">
                  {[...sortedStores].sort((a, b) => (b.splh || 0) - (a.splh || 0)).map((store, idx) => {
                    const maxSplh = Math.max(...stores.map((s) => s.splh || 0), 1)
                    const pct = ((store.splh || 0) / maxSplh) * 100
                    const isAboveAvg = (store.splh || 0) >= avgSplh
                    return (
                      <div key={store.organization?.id || idx} className="flex items-center gap-3">
                        <div className="w-24 text-sm font-medium text-gray-900 shrink-0 truncate">
                          {store.organization?.name || 'Unknown'}
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-100 rounded-full h-7 overflow-hidden relative">
                            <div
                              className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                              style={{ left: `${(avgSplh / Math.max(...stores.map((s) => s.splh || 0), 1)) * 100}%` }}
                            />
                            <div
                              className={`${isAboveAvg ? 'bg-emerald-500' : 'bg-amber-500'} h-full rounded-full flex items-center justify-end pr-2.5 transition-all`}
                              style={{ width: `${Math.max(pct, 3)}%` }}
                            >
                              {pct > 30 && (
                                <span className="text-[10px] font-semibold text-white">{fmt(store.splh)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="w-20 text-right shrink-0">
                          <p className={`text-xs font-semibold ${isAboveAvg ? 'text-emerald-600' : 'text-amber-600'}`}>{fmt(store.splh)}</p>
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-2">
                    <span className="w-3 h-px bg-red-400" /> Avg SPLH: {fmt(avgSplh)}
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}

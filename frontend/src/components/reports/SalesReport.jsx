import { useState, useEffect } from 'react'
import { reportsAPI, monthlyCloseAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'
import Badge from '../ui/Badge'

const DATE_MODES = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'custom', label: 'Custom' },
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

const SENIOR_ROLES = ['SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN']

export default function SalesReport() {
  const { user } = useAuth()
  const [dateMode, setDateMode] = useState('day')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  // Monthly close state
  const [monthClosed, setMonthClosed] = useState(false)
  const [closingAction, setClosingAction] = useState(false)

  const isSenior = user && SENIOR_ROLES.includes(user.role)

  useEffect(() => {
    if (dateMode === 'custom') {
      if (startDate && endDate) fetchSalesReport()
    } else {
      fetchSalesReport()
    }
  }, [date, startDate, endDate, dateMode])

  // Check monthly close status when in month mode
  useEffect(() => {
    if (dateMode === 'month') {
      const d = new Date(date + 'T00:00:00')
      checkMonthClose(d.getFullYear(), d.getMonth() + 1)
    } else {
      setMonthClosed(false)
    }
  }, [date, dateMode])

  const checkMonthClose = async (year, month) => {
    try {
      const res = await monthlyCloseAPI.summary(year, month)
      setMonthClosed(res.data.monthly_close?.status === 'CLOSED')
    } catch {
      setMonthClosed(false)
    }
  }

  const handleCloseMonth = async () => {
    const d = new Date(date + 'T00:00:00')
    setClosingAction(true)
    try {
      await monthlyCloseAPI.closeMonth({ year: d.getFullYear(), month: d.getMonth() + 1 })
      setMonthClosed(true)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to close month.')
    } finally {
      setClosingAction(false)
    }
  }

  const handleReopenMonth = async () => {
    const d = new Date(date + 'T00:00:00')
    setClosingAction(true)
    try {
      await monthlyCloseAPI.reopen({ year: d.getFullYear(), month: d.getMonth() + 1 })
      setMonthClosed(false)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to reopen month.')
    } finally {
      setClosingAction(false)
    }
  }

  const fetchSalesReport = async () => {
    setLoading(true)
    setError('')
    try {
      let response
      if (dateMode === 'day') {
        response = await reportsAPI.getSalesReportByDate(date)
      } else if (dateMode === 'week') {
        const { start, end } = getWeekRange(date)
        response = await reportsAPI.getSalesReportRange(start, end)
      } else if (dateMode === 'month') {
        const { start, end } = getMonthRange(date)
        response = await reportsAPI.getSalesReportRange(start, end)
      } else {
        response = await reportsAPI.getSalesReportRange(startDate, endDate)
      }
      setData(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sales report.')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v) =>
    `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const fmtDate = (d) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return d
    }
  }

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

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

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
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
          {dateMode === 'month' && monthClosed && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
              <span>🔒</span> Month Locked
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
            {dateMode !== 'day' && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                {getRangeLabel()}
              </span>
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

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Data */}
      {!loading && data && (
        <>
          {/* KPI Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Sales" value={fmt(data.statistics.total_sales)} />
            <KpiCard label="Daily Average" value={fmt(data.statistics.average_daily)} />
            <KpiCard
              label="Highest"
              value={fmt(data.statistics.highest?.amount)}
              sub={data.statistics.highest?.date ? fmtDate(data.statistics.highest.date) : undefined}
            />
            <KpiCard
              label="Trend"
              value={
                data.statistics.trend === 'up'
                  ? `↑ ${data.statistics.trend_percentage?.toFixed(1) || 0}%`
                  : data.statistics.trend === 'down'
                  ? `↓ ${data.statistics.trend_percentage?.toFixed(1) || 0}%`
                  : '— Flat'
              }
              alert={data.statistics.trend === 'down' ? 'Declining' : undefined}
            />
          </div>

          {/* Bar Chart */}
          <SectionLabel>Sales by {dateMode === 'day' ? 'Day' : dateMode === 'week' ? 'Week' : dateMode === 'month' ? 'Month' : 'Period'}</SectionLabel>
          <Card className="p-5">
            {data.data.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No data available.</p>
            ) : (
              <div className="space-y-2.5">
                {data.data.map((item, idx) => {
                  const total = parseFloat(item.actual_total || 0)
                  const maxSales = Math.max(...data.data.map((d) => parseFloat(d.actual_total || 0)), 1)
                  const pct = (total / maxSales) * 100
                  const label = item.date ? fmtDate(item.date) : item.period || ''
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-16 text-xs font-medium text-gray-400 text-right shrink-0">
                        {label}
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-100 rounded-full h-7 overflow-hidden">
                          <div
                            className="bg-gray-900 h-full rounded-full flex items-center justify-end pr-2.5 transition-all"
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          >
                            {pct > 25 && (
                              <span className="text-[10px] font-semibold text-white">{fmt(total)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="w-20 text-right shrink-0">
                        <p className="text-xs font-semibold text-gray-900">{fmt(total)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Detail Table */}
          <SectionLabel>Detail</SectionLabel>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Card</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Cash</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Variance</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((item, idx) => {
                    const variance = parseFloat(item.variance || 0)
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 transition">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {item.date ? fmtDate(item.date) : item.period}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{fmt(item.card_sales)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{fmt(item.cash_sales)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(item.actual_total)}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {variance > 0 ? '+' : ''}{fmt(variance)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
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
                    {monthClosed
                      ? 'Sales data for this month is locked.'
                      : 'Lock sales data after reconciliation is complete.'}
                  </p>
                </div>
                {monthClosed ? (
                  <button
                    onClick={handleReopenMonth}
                    disabled={closingAction}
                    className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:bg-gray-300 transition"
                  >
                    {closingAction ? 'Reopening...' : 'Reopen'}
                  </button>
                ) : (
                  <button
                    onClick={handleCloseMonth}
                    disabled={closingAction}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:bg-gray-300 transition"
                  >
                    {closingAction ? 'Closing...' : 'Close & Lock'}
                  </button>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

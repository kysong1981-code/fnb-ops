import { useState, useEffect } from 'react'
import { reportsAPI } from '../../services/api'
import { getTodayNZ } from '../../utils/date'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import Badge from '../ui/Badge'
import SectionLabel from '../ui/SectionLabel'

const DATE_MODES = [
  { key: 'day', label: 'Day' },
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

export default function HRCashReport() {
  const [dateMode, setDateMode] = useState('month')
  const [date, setDate] = useState(getTodayNZ())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [expandedDay, setExpandedDay] = useState(null)

  useEffect(() => {
    if (dateMode === 'custom') {
      if (startDate && endDate) fetchReport()
    } else {
      fetchReport()
    }
  }, [date, startDate, endDate, dateMode])

  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      let response
      if (dateMode === 'day') {
        response = await reportsAPI.getHRCashReport(date)
      } else if (dateMode === 'week') {
        const { start, end } = getWeekRange(date)
        response = await reportsAPI.getHRCashReportRange(start, end)
      } else if (dateMode === 'month') {
        const { start, end } = getMonthRange(date)
        response = await reportsAPI.getHRCashReportRange(start, end)
      } else {
        response = await reportsAPI.getHRCashReportRange(startDate, endDate)
      }
      setData(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load HR cash report.')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v) =>
    `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const inputCls =
    'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

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
      {/* Date selector */}
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
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition print:hidden"
          >
            Print
          </button>
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
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="HR Cash Total" value={fmt(data.totals.hr_cash_total)} />
            <KpiCard label="Cash Expenses" value={fmt(data.totals.expenses_total)} />
            <KpiCard label="Average Daily" value={fmt(data.totals.average_daily)} sub="Per active day" />
            <KpiCard label="Total Entries" value={data.totals.entry_count} />
          </div>

          {/* Recipient Summary */}
          {data.recipient_summary.length > 0 && (
            <>
              <SectionLabel>Recipient Summary</SectionLabel>
              <RecipientTable recipients={data.recipient_summary} fmt={fmt} />
            </>
          )}

          {/* Category Breakdown */}
          {data.category_summary.length > 0 && (
            <>
              <SectionLabel>Expense Categories</SectionLabel>
              <CategoryBreakdown categories={data.category_summary} fmt={fmt} />
            </>
          )}

          {/* Daily Detail */}
          {data.daily_reports.length > 0 ? (
            dateMode === 'month' ? (
              <MonthlyTable reports={data.daily_reports} fmt={fmt} />
            ) : (
              <DailyDetailCards
                reports={data.daily_reports}
                fmt={fmt}
                expandedDay={expandedDay}
                setExpandedDay={setExpandedDay}
              />
            )
          ) : (
            <Card className="p-8 text-center">
              <p className="text-gray-400 text-sm">No HR cash data for this period.</p>
            </Card>
          )}
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}


/* ──────────────────────────────────────────────
 * Recipient Summary Table
 * ────────────────────────────────────────────── */
function RecipientTable({ recipients, fmt }) {
  const maxAmount = Math.max(...recipients.map((r) => r.total_amount), 1)
  const total = recipients.reduce((s, r) => s + r.total_amount, 0)
  const totalCount = recipients.reduce((s, r) => s + r.count, 0)

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Recipient</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 w-[200px]">Amount</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 w-[80px]">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recipients.map((r) => {
              const pct = (r.total_amount / maxAmount) * 100
              return (
                <tr key={r.recipient_name} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.recipient_name}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-medium text-gray-900 min-w-[80px] text-right">{fmt(r.total_amount)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{r.count}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-900 text-white font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{fmt(total)}</td>
              <td className="px-4 py-3 text-right">{totalCount}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}


/* ──────────────────────────────────────────────
 * Category Breakdown
 * ────────────────────────────────────────────── */
function CategoryBreakdown({ categories, fmt }) {
  const badgeVariant = (cat) => {
    if (cat === 'SUPPLIES') return 'info'
    if (cat === 'MAINTENANCE') return 'warning'
    return 'neutral'
  }
  const total = categories.reduce((s, c) => s + c.total_amount, 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {categories.map((cat) => {
        const pct = total > 0 ? ((cat.total_amount / total) * 100).toFixed(0) : 0
        return (
          <Card key={cat.category} className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={badgeVariant(cat.category)}>{cat.category_display}</Badge>
              <span className="text-xs text-gray-400">{cat.count} entries</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{fmt(cat.total_amount)}</p>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  cat.category === 'SUPPLIES' ? 'bg-blue-400'
                    : cat.category === 'MAINTENANCE' ? 'bg-amber-400'
                    : 'bg-gray-400'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{pct}% of total expenses</p>
          </Card>
        )
      })}
    </div>
  )
}


/* ──────────────────────────────────────────────
 * Monthly Summary Table
 * ────────────────────────────────────────────── */
function MonthlyTable({ reports, fmt }) {
  const totals = reports.reduce(
    (acc, d) => ({
      hr_cash: acc.hr_cash + parseFloat(d.hr_cash_total || 0),
      expenses: acc.expenses + parseFloat(d.cash_expenses_total || 0),
      total: acc.total + parseFloat(d.hr_cash_total || 0) + parseFloat(d.cash_expenses_total || 0),
    }),
    { hr_cash: 0, expenses: 0, total: 0 }
  )

  const fmtShortDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">HR Cash</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Expenses</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.map((day) => {
              const dayTotal = parseFloat(day.hr_cash_total || 0) + parseFloat(day.cash_expenses_total || 0)
              return (
                <tr key={day.date} className="hover:bg-gray-50/50 transition align-top">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{fmtShortDate(day.date)}</td>
                  <td className="px-4 py-2.5">
                    {day.hr_cash_entries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className="text-xs text-gray-500 truncate">{e.recipient_name || 'N/A'}</span>
                        <span className="text-blue-600 font-medium text-sm whitespace-nowrap">{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2.5">
                    {day.cash_expenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className="text-xs text-gray-500 truncate">{e.reason}</span>
                        <span className="text-amber-600 font-medium text-sm whitespace-nowrap">{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(dayTotal)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-900 text-white font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{fmt(totals.hr_cash)}</td>
              <td className="px-4 py-3 text-right">{fmt(totals.expenses)}</td>
              <td className="px-4 py-3 text-right">{fmt(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}


/* ──────────────────────────────────────────────
 * Daily Detail Cards (Day/Week/Custom mode)
 * ────────────────────────────────────────────── */
function DailyDetailCards({ reports, fmt, expandedDay, setExpandedDay }) {
  return (
    <div className="space-y-3">
      {reports.map((day) => {
        const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', weekday: 'short',
        })
        const dayTotal = parseFloat(day.hr_cash_total || 0) + parseFloat(day.cash_expenses_total || 0)
        const isExpanded = expandedDay === day.date

        // Evidence
        const evidences = [
          ...day.hr_cash_entries
            .filter((e) => e.photo)
            .map((e) => ({ type: 'photo', label: `HR-${e.recipient_name || 'N/A'}`, url: e.photo })),
          ...day.cash_expenses
            .filter((e) => e.attachment)
            .map((e) => ({ type: 'file', label: e.reason, url: e.attachment })),
        ]

        return (
          <Card key={day.date} className="overflow-hidden">
            {/* Header — clickable to expand */}
            <button
              onClick={() => setExpandedDay(isExpanded ? null : day.date)}
              className="w-full px-5 py-3 flex items-center justify-between bg-gray-50/50 hover:bg-gray-100/50 transition border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                <span className="text-sm font-semibold text-gray-900">{dateStr}</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                {day.hr_cash_total > 0 && (
                  <span className="text-blue-600 font-medium">HR Cash {fmt(day.hr_cash_total)}</span>
                )}
                {day.cash_expenses_total > 0 && (
                  <span className="text-amber-600 font-medium">Expenses {fmt(day.cash_expenses_total)}</span>
                )}
                <span className="font-bold text-gray-900">{fmt(dayTotal)}</span>
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="divide-y divide-gray-50">
                {/* HR Cash entries */}
                {day.hr_cash_entries.length > 0 && (
                  <div>
                    <div className="px-5 py-2.5 bg-blue-50/50">
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">HR Cash</span>
                    </div>
                    {day.hr_cash_entries.map((entry) => (
                      <div key={entry.id} className="flex justify-between items-center px-5 pl-10 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 font-medium">{entry.recipient_name || 'N/A'}</span>
                          {entry.notes && <span className="text-xs text-gray-400">({entry.notes})</span>}
                          {entry.photo && (
                            <a href={entry.photo} target="_blank" rel="noopener noreferrer">
                              <Badge variant="info">Photo</Badge>
                            </a>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{fmt(entry.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cash Expense entries */}
                {day.cash_expenses.length > 0 && (
                  <div>
                    <div className="px-5 py-2.5 bg-amber-50/50">
                      <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Cash Expenses</span>
                    </div>
                    {day.cash_expenses.map((expense) => (
                      <div key={expense.id} className="flex justify-between items-center px-5 pl-10 py-2.5">
                        <div className="flex items-center gap-2">
                          <Badge variant={expense.category === 'SUPPLIES' ? 'info' : expense.category === 'MAINTENANCE' ? 'warning' : 'neutral'}>
                            {expense.category_display}
                          </Badge>
                          <span className="text-sm text-gray-700">{expense.reason}</span>
                          {expense.attachment && (
                            <a href={expense.attachment} target="_blank" rel="noopener noreferrer">
                              <Badge variant="purple">Receipt</Badge>
                            </a>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{fmt(expense.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Total bar */}
                <div className="flex justify-between items-center px-5 py-3 bg-gray-900 text-white">
                  <span className="text-sm font-semibold">Day Total</span>
                  <span className="text-sm font-bold">{fmt(dayTotal)}</span>
                </div>

                {/* Evidence */}
                {evidences.length > 0 && (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Evidence</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {evidences.map((ev, idx) => (
                        <a
                          key={idx}
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center hover:border-gray-300 transition"
                        >
                          <div className="text-xl mb-1">{ev.type === 'photo' ? '📷' : '📎'}</div>
                          <p className="text-[10px] text-gray-500 truncate">{ev.label}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

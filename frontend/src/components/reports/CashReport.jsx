import { useState, useEffect, Fragment } from 'react'
import { reportsAPI, monthlyCloseAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import Badge from '../ui/Badge'
import SectionLabel from '../ui/SectionLabel'

const SENIOR_ROLES = ['SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN']

const DATE_MODES = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'custom', label: 'Custom' },
]

function getWeekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return {
    start: mon.toISOString().split('T')[0],
    end: sun.toISOString().split('T')[0],
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

export default function CashReport() {
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
      if (startDate && endDate) fetchCashReport()
    } else {
      fetchCashReport()
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

  const fetchCashReport = async () => {
    setLoading(true)
    setError('')
    try {
      let response
      if (dateMode === 'day') {
        response = await reportsAPI.getCashReport(date)
      } else if (dateMode === 'week') {
        const { start, end } = getWeekRange(date)
        response = await reportsAPI.getCashReportRange(start, end)
      } else if (dateMode === 'month') {
        const { start, end } = getMonthRange(date)
        response = await reportsAPI.getCashReportRange(start, end)
      } else {
        response = await reportsAPI.getCashReportRange(startDate, endDate)
      }
      setData(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load cash report.')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
      {/* Date selector + Print */}
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
          <div className="flex items-center gap-2">
            {dateMode === 'month' && monthClosed && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
                <span>🔒</span> Month Locked
              </span>
            )}
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition print:hidden"
            >
              Print
            </button>
          </div>
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard label="Cash Sales" value={fmt(data.totals.cash_sales)} />
            <KpiCard label="Bank Deposit" value={fmt(data.totals.bank_deposit)} />
            <KpiCard label="HR Cash" value={fmt(data.totals.hr_cash_total)} />
            <KpiCard label="Expenses" value={fmt(data.totals.cash_expenses_total)} />
            <KpiCard
              label="HR Balance"
              value={fmt(data.totals.balance - data.totals.cash_expenses_total)}
              alert={(data.totals.balance - data.totals.cash_expenses_total) < 0 ? 'Negative' : undefined}
            />
          </div>

          {/* Missing days warning */}
          {data.missing_count > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-red-500 text-lg">⚠</span>
              <p className="text-red-700 text-sm font-medium">
                <span className="font-bold">{data.missing_count}</span> day{data.missing_count !== 1 ? 's' : ''} not closed — Cash Up required
              </p>
            </div>
          )}

          {/* Month mode: Summary Table */}
          {dateMode === 'month' ? (
            <MonthlyTable reports={data.daily_reports} fmt={fmt} />
          ) : (
            /* Day / Week / Custom: Detail Cards */
            <>
              {data.daily_reports.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-gray-400 text-sm">No data for this period.</p>
                </Card>
              ) : (
                data.daily_reports.map((day) =>
                  day.has_data === false ? (
                    <Card key={day.date} className="overflow-hidden border-l-4 border-l-red-400">
                      <div className="px-5 py-3 bg-red-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-red-500 text-lg">⚠</span>
                          <div>
                            <p className="text-sm font-semibold text-red-700">
                              {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'short' })}
                            </p>
                            <p className="text-xs text-red-500">Not Closed — Cash Up required</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <DayCashDetail key={day.date} day={day} fmt={fmt} />
                  )
                )
              )}
            </>
          )}
        </>
      )}

      {/* Monthly Close/Lock */}
      {dateMode === 'month' && isSenior && !loading && data && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {monthClosed ? '🔒 Month Closed' : 'Close Month'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {monthClosed
                  ? 'Cash data for this month is locked.'
                  : 'Lock cash data after reconciliation is complete.'}
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
 * Monthly Summary Table
 * Date → Cash Sales → Bank Deposit → HR Cash → Balance → Expenses(내역) → HR Balance
 * ────────────────────────────────────────────── */
function MonthlyTable({ reports, fmt }) {
  const [expandedDate, setExpandedDate] = useState(null)

  if (!reports || reports.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-400 text-sm">No data for this month.</p>
      </Card>
    )
  }

  const totals = reports.reduce(
    (acc, d) => ({
      cash_sales: acc.cash_sales + parseFloat(d.cash_sales || 0),
      bank_deposit: acc.bank_deposit + parseFloat(d.bank_deposit || 0),
      hr_cash: acc.hr_cash + parseFloat(d.hr_cash_total || 0),
      expenses: acc.expenses + parseFloat(d.cash_expenses_total || 0),
      balance: acc.balance + parseFloat(d.balance || 0),
    }),
    { cash_sales: 0, bank_deposit: 0, hr_cash: 0, expenses: 0, balance: 0 }
  )
  const hrBalanceTotal = totals.balance - totals.expenses

  const fmtShortDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 800 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-3 font-semibold text-gray-600">Date</th>
              <th className="text-right px-3 py-3 font-semibold text-gray-600">Cash Sales</th>
              <th className="text-right px-3 py-3 font-semibold text-gray-600">Bank Deposit</th>
              <th className="text-right px-3 py-3 font-semibold text-gray-600">HR Cash</th>
              <th className="text-right px-3 py-3 font-semibold text-gray-600">Balance</th>
              <th className="text-left px-3 py-3 font-semibold text-gray-600">Expenses</th>
              <th className="text-right px-3 py-3 font-semibold text-gray-600">HR Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.map((day) => {
              const bal = parseFloat(day.balance || 0)
              const expTotal = parseFloat(day.cash_expenses_total || 0)
              const hrBalance = bal - expTotal
              const hasExpenses = day.cash_expenses && day.cash_expenses.length > 0
              const isExpanded = expandedDate === day.date
              // Brief summary of expense reasons
              const expSummary = day.cash_expenses?.map((e) => e.reason).join(', ') || ''

              // Missing day — highlight red
              if (!day.has_data) {
                return (
                  <tr key={day.date} className="bg-red-50/60">
                    <td className="px-3 py-2.5 font-medium text-red-400 whitespace-nowrap">{fmtShortDate(day.date)}</td>
                    <td colSpan={6} className="px-3 py-2.5">
                      <span className="text-red-500 text-xs font-semibold">Not Closed</span>
                      <span className="text-red-400 text-[11px] ml-2">Cash Up required</span>
                    </td>
                  </tr>
                )
              }

              return (
                <Fragment key={day.date}>
                  <tr className={`hover:bg-gray-50/50 transition align-top ${day.status === 'DRAFT' ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{fmtShortDate(day.date)}</span>
                      {day.status && day.status !== 'APPROVED' && (
                        <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          day.status === 'DRAFT' ? 'bg-amber-100 text-amber-600'
                            : day.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-600'
                            : day.status === 'REJECTED' ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>{day.status}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-600 font-medium">{fmt(day.cash_sales)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{fmt(day.bank_deposit)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-gray-700 font-medium">{fmt(day.hr_cash_total)}</span>
                      {day.hr_cash_entries?.length > 0 && (
                        <p className="text-[11px] text-gray-400 truncate max-w-[120px] ml-auto">
                          {day.hr_cash_entries.map((e) => e.recipient_name || 'N/A').join(', ')}
                        </p>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${bal < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {fmt(bal)}
                    </td>
                    <td className="px-3 py-2.5">
                      {hasExpenses ? (
                        <button
                          onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                          className="text-left w-full group"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] text-gray-400 transition-transform inline-block ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                            <span className="text-amber-600 font-medium">{fmt(expTotal)}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 truncate max-w-[160px] group-hover:text-gray-600 transition">
                            {expSummary}
                          </p>
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${hrBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {fmt(hrBalance)}
                    </td>
                  </tr>
                  {/* Expanded expense & HR cash detail */}
                  {isExpanded && (
                    <tr className="bg-gray-50/60">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-3">
                          {/* HR Cash entries */}
                          {day.hr_cash_entries?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1.5">HR Cash</p>
                              <div className="space-y-2">
                                {day.hr_cash_entries.map((entry) => (
                                  <div key={entry.id} className="bg-white rounded-lg border border-gray-100 p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900">{entry.recipient_name || 'N/A'}</span>
                                        {entry.notes && <span className="text-xs text-gray-400">({entry.notes})</span>}
                                      </div>
                                      <span className="text-sm font-semibold text-blue-700">{fmt(entry.amount)}</span>
                                    </div>
                                    {entry.photo && (
                                      <a href={entry.photo} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                        <img
                                          src={entry.photo}
                                          alt={`HR Cash - ${entry.recipient_name}`}
                                          className="w-full max-w-[200px] h-auto rounded-lg border border-gray-200 hover:border-blue-400 transition"
                                        />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Cash Expenses */}
                          {hasExpenses && (
                            <div>
                              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Cash Expenses</p>
                              <div className="space-y-2">
                                {day.cash_expenses.map((expense) => (
                                  <div key={expense.id} className="bg-white rounded-lg border border-gray-100 p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Badge variant={expense.category === 'SUPPLIES' ? 'info' : expense.category === 'MAINTENANCE' ? 'warning' : 'neutral'}>
                                          {expense.category_display}
                                        </Badge>
                                        <span className="text-sm text-gray-700">{expense.reason}</span>
                                      </div>
                                      <span className="text-sm font-semibold text-amber-700 whitespace-nowrap">{fmt(expense.amount)}</span>
                                    </div>
                                    {expense.attachment && (
                                      <a href={expense.attachment} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(expense.attachment) ? (
                                          <img
                                            src={expense.attachment}
                                            alt={expense.reason}
                                            className="w-full max-w-[200px] h-auto rounded-lg border border-gray-200 hover:border-amber-400 transition"
                                          />
                                        ) : (
                                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 transition">
                                            📎 {expense.attachment.split('/').pop()}
                                          </div>
                                        )}
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-900 text-white font-semibold">
              <td className="px-3 py-3">Total</td>
              <td className="px-3 py-3 text-right">{fmt(totals.cash_sales)}</td>
              <td className="px-3 py-3 text-right">{fmt(totals.bank_deposit)}</td>
              <td className="px-3 py-3 text-right">{fmt(totals.hr_cash)}</td>
              <td className="px-3 py-3 text-right">{fmt(totals.balance)}</td>
              <td className="px-3 py-3 text-right">{fmt(totals.expenses)}</td>
              <td className={`px-3 py-3 text-right ${hrBalanceTotal < 0 ? 'text-red-300' : ''}`}>
                {fmt(hrBalanceTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}


/* ──────────────────────────────────────────────
 * Day Detail Card (existing)
 * ────────────────────────────────────────────── */
function DayCashDetail({ day, fmt }) {
  const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', weekday: 'short',
  })

  return (
    <Card className="overflow-hidden">
      {/* Date header */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <p className="text-sm font-semibold text-gray-900">{dateStr}</p>
      </div>

      {/* Cash Flow table */}
      <div className="divide-y divide-gray-50">
        {/* Cash Sales */}
        <div className="flex justify-between items-center px-5 py-3">
          <span className="text-sm text-gray-700">Cash Sales</span>
          <span className="text-sm font-semibold text-emerald-600">+ {fmt(day.cash_sales)}</span>
        </div>

        {/* Bank Deposit */}
        {day.bank_deposit > 0 && (
          <div className="flex justify-between items-center px-5 py-3">
            <span className="text-sm text-gray-700">Bank Deposit</span>
            <span className="text-sm font-semibold text-red-500">- {fmt(day.bank_deposit)}</span>
          </div>
        )}

        {/* HR Cash */}
        {day.hr_cash_total > 0 && (
          <div>
            <div className="flex justify-between items-center px-5 py-3">
              <span className="text-sm text-gray-700">HR Cash</span>
              <span className="text-sm font-semibold text-red-500">- {fmt(day.hr_cash_total)}</span>
            </div>
            {day.hr_cash_entries.map((entry) => (
              <div key={entry.id} className="px-5 pl-10 py-2 bg-gray-50/50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{entry.recipient_name || 'N/A'}</span>
                    {entry.notes && <span className="text-xs text-gray-400">({entry.notes})</span>}
                  </div>
                  <span className="text-xs font-medium text-gray-600">{fmt(entry.amount)}</span>
                </div>
                {entry.photo && (
                  <a href={entry.photo} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
                    <img
                      src={entry.photo}
                      alt={`HR Cash - ${entry.recipient_name}`}
                      className="w-full max-w-[180px] h-auto rounded-lg border border-gray-200 hover:border-blue-400 transition"
                    />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Cash Expenses */}
        {day.cash_expenses_total > 0 && (
          <div>
            <div className="flex justify-between items-center px-5 py-3">
              <span className="text-sm text-gray-700">Cash Expenses</span>
              <span className="text-sm font-semibold text-red-500">- {fmt(day.cash_expenses_total)}</span>
            </div>
            {day.cash_expenses.map((expense) => (
              <div key={expense.id} className="px-5 pl-10 py-2 bg-gray-50/50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{expense.category_display}</Badge>
                    <span className="text-xs text-gray-500">{expense.reason}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-600">{fmt(expense.amount)}</span>
                </div>
                {expense.attachment && (
                  <a href={expense.attachment} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
                    {/\.(jpg|jpeg|png|gif|webp)$/i.test(expense.attachment) ? (
                      <img
                        src={expense.attachment}
                        alt={expense.reason}
                        className="w-full max-w-[180px] h-auto rounded-lg border border-gray-200 hover:border-amber-400 transition"
                      />
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 transition">
                        📎 {expense.attachment.split('/').pop()}
                      </div>
                    )}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Balance */}
        <div className="flex justify-between items-center px-5 py-3.5 bg-gray-900 text-white">
          <span className="text-sm font-semibold">Balance</span>
          <span className="text-sm font-bold">{fmt(day.balance)}</span>
        </div>
      </div>

    </Card>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { monthlyCloseAPI } from '../../services/api'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import {
  ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon, WarningIcon,
} from '../icons'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const SENIOR_ROLES = ['SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']

const fmt = (v) =>
  `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDateShort = (d) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  } catch {
    return d
  }
}

export default function MonthlyClosePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSenior = SENIOR_ROLES.includes(user?.role)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notes, setNotes] = useState('')
  const [showForceClose, setShowForceClose] = useState(false)

  useEffect(() => {
    fetchSummary()
    setShowForceClose(false)
    setNotes('')
  }, [year, month])

  const fetchSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await monthlyCloseAPI.summary(year, month)
      setSummary(res.data)
    } catch (err) {
      setError('Failed to load monthly summary')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCloseMonth = async () => {
    setActionLoading(true)
    setError('')
    try {
      await monthlyCloseAPI.closeMonth({ year, month, notes })
      setSuccess('Month closed successfully')
      setNotes('')
      setShowForceClose(false)
      setTimeout(() => setSuccess(''), 3000)
      fetchSummary()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to close month')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReopen = async () => {
    setActionLoading(true)
    setError('')
    try {
      await monthlyCloseAPI.reopen({ year, month, notes })
      setSuccess('Month reopened')
      setNotes('')
      setTimeout(() => setSuccess(''), 3000)
      fetchSummary()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reopen month')
    } finally {
      setActionLoading(false)
    }
  }

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  const dc = summary?.daily_closings || {}
  const ss = summary?.supplier_statements || {}
  const totals = summary?.totals || {}
  const mc = summary?.monthly_close
  const isClosed = mc?.status === 'CLOSED'
  const allReady = summary?.all_ready || false

  const closingPct = dc.total > 0 ? Math.round((dc.approved / dc.total) * 100) : 0
  const stmtPct = ss.suppliers_with_costs > 0
    ? Math.round((ss.matched / ss.suppliers_with_costs) * 100)
    : 100

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Monthly Close</h1>
          <p className="text-sm text-gray-400 mt-0.5">Close month when all items are reconciled</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <ChevronLeftIcon size={18} className="text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-[130px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <ChevronRightIcon size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && summary && (
        <>
          {/* Closed Status Banner */}
          {isClosed && (
            <Card className="p-4 bg-emerald-50 border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircleIcon size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-800">Month Closed</span>
                      <Badge variant="success">CLOSED</Badge>
                    </div>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {mc.closed_by_name && `Closed by ${mc.closed_by_name}`}
                      {mc.closed_at && ` on ${new Date(mc.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  </div>
                </div>
                {isSenior && (
                  <button
                    onClick={handleReopen}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition disabled:opacity-50"
                  >
                    {actionLoading ? '...' : 'Reopen'}
                  </button>
                )}
              </div>
              {mc.notes && (
                <p className="text-xs text-emerald-600 mt-2 pl-[52px]">Notes: {mc.notes}</p>
              )}
            </Card>
          )}

          {/* Daily Closings Card */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-900">Daily Closings</span>
                {dc.total > 0 && dc.approved === dc.total ? (
                  <CheckCircleIcon size={18} className="text-emerald-500" />
                ) : dc.total > 0 ? (
                  <WarningIcon size={18} className="text-amber-500" />
                ) : null}
              </div>
              <span className="text-sm font-semibold text-gray-600">
                {dc.approved || 0}/{dc.total || 0} approved
              </span>
            </div>

            {/* Progress bar */}
            {dc.total > 0 && (
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    closingPct === 100 ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${closingPct}%` }}
                />
              </div>
            )}

            {dc.total === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">No closings for this month</p>
            ) : dc.approved === dc.total ? (
              <p className="text-sm text-emerald-600 text-center py-1">All closings approved</p>
            ) : (
              <div className="space-y-1.5 mt-2">
                <p className="text-xs text-gray-500 font-semibold mb-1">Outstanding:</p>
                {(dc.outstanding || []).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/closing/form?date=${item.closing_date}`)}
                    className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg cursor-pointer hover:bg-amber-100 transition"
                  >
                    <span className="text-sm text-gray-800">{fmtDateShort(item.closing_date)}</span>
                    <Badge variant={item.status === 'DRAFT' ? 'neutral' : item.status === 'SUBMITTED' ? 'info' : 'danger'}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Breakdown counts */}
            {dc.total > 0 && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                {dc.draft > 0 && <span className="text-xs text-gray-500">Draft: {dc.draft}</span>}
                {dc.submitted > 0 && <span className="text-xs text-blue-600">Submitted: {dc.submitted}</span>}
                {dc.approved > 0 && <span className="text-xs text-emerald-600">Approved: {dc.approved}</span>}
                {dc.rejected > 0 && <span className="text-xs text-red-500">Rejected: {dc.rejected}</span>}
              </div>
            )}
          </Card>

          {/* Supplier Statements Card */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-900">Supplier Statements</span>
                {ss.suppliers_with_costs > 0 && ss.matched === ss.suppliers_with_costs ? (
                  <CheckCircleIcon size={18} className="text-emerald-500" />
                ) : ss.suppliers_with_costs > 0 ? (
                  <WarningIcon size={18} className="text-amber-500" />
                ) : null}
              </div>
              <span className="text-sm font-semibold text-gray-600">
                {ss.matched || 0}/{ss.suppliers_with_costs || 0} matched
              </span>
            </div>

            {/* Progress bar */}
            {ss.suppliers_with_costs > 0 && (
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    stmtPct === 100 ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${stmtPct}%` }}
                />
              </div>
            )}

            {ss.suppliers_with_costs === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">No supplier costs this month</p>
            ) : ss.matched === ss.suppliers_with_costs ? (
              <p className="text-sm text-emerald-600 text-center py-1">All suppliers reconciled</p>
            ) : (
              <div className="space-y-1.5 mt-2">
                {/* Mismatched / Pending statements */}
                {(ss.outstanding || []).length > 0 && (
                  <>
                    <p className="text-xs text-gray-500 font-semibold mb-1">Outstanding:</p>
                    {ss.outstanding.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg"
                      >
                        <span className="text-sm text-gray-800">{item.supplier__name}</span>
                        <div className="flex items-center gap-2">
                          {item.variance != null && parseFloat(item.variance) !== 0 && (
                            <span className="text-xs font-semibold text-red-600">{fmt(item.variance)}</span>
                          )}
                          <Badge variant={item.status === 'MISMATCHED' ? 'danger' : 'warning'}>
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Suppliers without statements */}
                {ss.suppliers_without_statement > 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    {ss.suppliers_without_statement} supplier(s) have no statement uploaded yet
                  </p>
                )}
              </div>
            )}

            {/* Link to Supply Report */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => navigate('/reports')}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                View Supply Report for details &rarr;
              </button>
            </div>
          </Card>

          {/* Month Totals */}
          <Card className="p-5">
            <span className="text-base font-bold text-gray-900 block mb-3">Month Totals</span>
            <p className="text-xs text-gray-400 mb-3">From approved closings only</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">POS Card</p>
                <p className="text-sm font-bold text-gray-900">{fmt(totals.total_pos_card)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">POS Cash</p>
                <p className="text-sm font-bold text-gray-900">{fmt(totals.total_pos_cash)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Actual Card</p>
                <p className="text-sm font-bold text-gray-900">{fmt(totals.total_actual_card)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Actual Cash</p>
                <p className="text-sm font-bold text-gray-900">{fmt(totals.total_actual_cash)}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mt-3">
              <p className="text-xs text-gray-500">Bank Deposit Total</p>
              <p className="text-lg font-bold text-gray-900">{fmt(totals.total_bank_deposit)}</p>
            </div>
          </Card>

          {/* Close / Reopen Action */}
          {!isClosed && isSenior && (
            <Card className="p-5">
              {allReady ? (
                <>
                  <div className="text-center mb-4">
                    <CheckCircleIcon size={32} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-emerald-700">All items are ready</p>
                    <p className="text-xs text-gray-400 mt-0.5">You can close this month</p>
                  </div>
                  <button
                    onClick={handleCloseMonth}
                    disabled={actionLoading}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    {actionLoading ? 'Closing...' : 'Close Month'}
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <WarningIcon size={32} className="text-amber-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-amber-700">Some items are outstanding</p>
                    <p className="text-xs text-gray-400 mt-0.5">Resolve all items above, or force close with notes</p>
                  </div>

                  {!showForceClose ? (
                    <button
                      onClick={() => setShowForceClose(true)}
                      className="w-full py-3 border border-amber-300 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-50 transition"
                    >
                      Force Close with Notes
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Explain why you are closing with outstanding items..."
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setShowForceClose(false); setNotes('') }}
                          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCloseMonth}
                          disabled={actionLoading || !notes.trim()}
                          className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition"
                        >
                          {actionLoading ? 'Closing...' : 'Force Close'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          {/* Non-senior info */}
          {!isClosed && !isSenior && (
            <Card className="p-4 bg-gray-50">
              <p className="text-sm text-gray-500 text-center">
                Only Senior Managers can close or reopen months.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

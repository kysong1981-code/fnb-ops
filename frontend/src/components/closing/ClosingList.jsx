import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { closingAPI } from '../../services/api'
import { getTodayNZ } from '../../utils/date'
import Card from '../ui/Card'
import { PlusIcon, ArrowRightIcon } from '../icons'

const MANAGER_ROLES = ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']

export default function ClosingList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [closings, setClosings] = useState([])
  const [loading, setLoading] = useState(true)

  const isManager = user && MANAGER_ROLES.includes(user.role)

  // Current month view
  const [viewDate, setViewDate] = useState(new Date())
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  useEffect(() => {
    fetchClosings()
  }, [year, month])

  const fetchClosings = async () => {
    setLoading(true)
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const res = await closingAPI.list({ closing_date__gte: startDate, closing_date__lte: endDate })
      setClosings(res.data.results || res.data || [])
    } catch {
      setClosings([])
    } finally {
      setLoading(false)
    }
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayStr = getTodayNZ()

  // Map closings by date
  const closingMap = {}
  closings.forEach(c => { closingMap[c.closing_date] = c })

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthName = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  // Monthly totals (only Submitted/Approved)
  const validClosings = closings.filter(c => ['SUBMITTED', 'APPROVED'].includes(c.status))
  const totalPOS = validClosings.reduce((s, c) => s + parseFloat(c.pos_total || 0), 0)
  const totalActual = validClosings.reduce((s, c) => s + parseFloat(c.actual_total || 0), 0)
  const totalVariance = validClosings.reduce((s, c) => s + parseFloat(c.total_variance || 0), 0)
  const approvedCount = closings.filter(c => c.status === 'APPROVED').length
  const submittedCount = closings.filter(c => c.status === 'SUBMITTED').length

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Daily Closing</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isManager ? 'Review and approve closings' : 'Your closing records'}
          </p>
        </div>
        <button
          onClick={() => navigate('/closing/form')}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
        >
          <PlusIcon size={16} />
          Today
        </button>
      </div>

      {/* Incomplete dates for current month */}
      {(() => {
        const incompleteDates = []
        for (let d = 1; d <= Math.min(daysInMonth, todayStr >= `${year}-${String(month+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}` ? daysInMonth : parseInt(todayStr.split('-')[2]) || 0); d++) {
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          if (dateStr >= todayStr) continue
          const c = closingMap[dateStr]
          if (!c || !['SUBMITTED','APPROVED'].includes(c.status)) incompleteDates.push(dateStr)
        }
        if (incompleteDates.length === 0) return null
        return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm font-semibold text-red-700 mb-2">
              {incompleteDates.length} day{incompleteDates.length > 1 ? 's' : ''} incomplete
            </p>
            <div className="flex flex-wrap gap-2">
              {incompleteDates.slice(0, 10).map(d => (
                <button key={d} onClick={() => navigate(`/closing/form?date=${d}`)}
                  className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-lg hover:bg-red-200 transition font-medium">
                  {new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',weekday:'short'})}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Month Summary */}
      {closings.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xs text-gray-400">POS Total</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{fmt(totalPOS)}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-gray-400">Actual Total</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{fmt(totalActual)}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-gray-400">Variance</p>
            <p className={`text-sm font-bold mt-0.5 ${totalVariance === 0 ? 'text-green-600' : totalVariance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {totalVariance >= 0 ? '+' : ''}{fmt(totalVariance)}
            </p>
          </Card>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 className="text-base font-semibold text-gray-900">{monthName}</h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Status Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Submitted ({submittedCount})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Approved ({approvedCount})</span>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {dayNames.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[72px] border-b border-r border-gray-50 bg-gray-50/50" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const closing = closingMap[dateStr]
              const isToday = dateStr === todayStr
              const isFuture = dateStr > todayStr

              return (
                <button
                  key={day}
                  onClick={() => !isFuture && navigate(`/closing/form?date=${dateStr}`)}
                  disabled={isFuture}
                  className={`min-h-[72px] border-b border-r border-gray-50 p-1.5 text-left transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default ${
                    isToday ? 'bg-blue-50/50' : ''
                  }`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${
                      isToday ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center' :
                      'text-gray-700'
                    }`}>
                      {day}
                    </span>
                    {closing && ['SUBMITTED', 'APPROVED'].includes(closing.status) && (
                      <span className={`w-2 h-2 rounded-full ${
                        closing.status === 'APPROVED' ? 'bg-green-500' : 'bg-blue-500'
                      }`} />
                    )}
                  </div>

                  {/* Closing data - only Submitted/Approved */}
                  {closing && ['SUBMITTED', 'APPROVED'].includes(closing.status) && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-semibold text-gray-700 truncate">
                        {fmt(parseFloat(closing.pos_total || 0))}
                      </p>
                      {parseFloat(closing.total_variance || 0) !== 0 && (
                        <p className={`text-[10px] font-medium ${
                          parseFloat(closing.total_variance) > 0 ? 'text-blue-500' : 'text-red-500'
                        }`}>
                          {parseFloat(closing.total_variance) >= 0 ? '+' : ''}
                          {fmt(closing.total_variance)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* No closing - show dash for past non-future days */}
                  {!closing && !isFuture && !isToday && (
                    <p className="text-[10px] text-gray-300 mt-1">—</p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

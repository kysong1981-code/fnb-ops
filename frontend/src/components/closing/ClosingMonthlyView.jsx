import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { closingAPI } from '../../services/api'
import Card from '../ui/Card'
import { ChevronLeftIcon, ChevronRightIcon, ArrowRightIcon } from '../icons'

const STATUS_COLORS = {
  DRAFT: { bg: 'bg-gray-200', ring: 'ring-gray-300', text: 'text-gray-600', label: 'Draft' },
  SUBMITTED: { bg: 'bg-blue-500', ring: 'ring-blue-300', text: 'text-blue-700', label: 'Submitted' },
  APPROVED: { bg: 'bg-green-500', ring: 'ring-green-300', text: 'text-green-700', label: 'Approved' },
  REJECTED: { bg: 'bg-red-500', ring: 'ring-red-300', text: 'text-red-700', label: 'Rejected' },
}

export default function ClosingMonthlyView() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [closings, setClosings] = useState({})
  const [loading, setLoading] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() // 0-based

  useEffect(() => {
    fetchClosings()
  }, [year, month])

  const fetchClosings = async () => {
    setLoading(true)
    try {
      // Fetch all closings for this month
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const res = await closingAPI.list({
        closing_date__gte: startDate,
        closing_date__lte: endDate,
      })
      const items = res.data?.results || res.data || []

      // Map by date
      const map = {}
      items.forEach(c => {
        map[c.closing_date] = c
      })
      setClosings(map)
    } catch (err) {
      console.error('Failed to fetch closings:', err)
    } finally {
      setLoading(false)
    }
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // Calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Build weeks
  const weeks = []
  let week = new Array(firstDayOfMonth).fill(null)

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 p-1">
          <ChevronLeftIcon size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Daily Closings</h1>
        <div className="w-8" />
      </div>

      {/* Month Navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeftIcon size={18} className="text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-900">{monthName}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronRightIcon size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mt-4 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0.5">
                {week.map((day, di) => {
                  if (!day) return <div key={di} className="aspect-square" />

                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const closing = closings[dateStr]
                  const isToday = dateStr === todayStr
                  const isFuture = dateStr > todayStr
                  const sc = closing ? STATUS_COLORS[closing.status] : null

                  return (
                    <button
                      key={di}
                      onClick={() => !isFuture && navigate(`/closing/form?date=${dateStr}`)}
                      disabled={isFuture}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition
                        ${isToday ? 'ring-2 ring-blue-400' : ''}
                        ${isFuture ? 'opacity-30 cursor-not-allowed' : closing ? 'hover:opacity-80' : 'hover:bg-gray-50'}
                      `}
                    >
                      <span className={`text-sm font-medium ${isFuture ? 'text-gray-300' : isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                        {day}
                      </span>
                      {closing && (
                        <div className={`w-2 h-2 rounded-full mt-0.5 ${sc.bg}`} />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100">
          {Object.entries(STATUS_COLORS).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${val.bg}`} />
              <span className="text-xs text-gray-500">{val.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* List of closings this month */}
      {Object.keys(closings).length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-700">
              {currentDate.toLocaleDateString('en-US', { month: 'long' })} Closings
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {Object.entries(closings)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([dateStr, c]) => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS.DRAFT
                const variance = parseFloat(c.total_variance || 0)
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/closing/form?date=${dateStr}`)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center w-8">
                        <p className="text-lg font-bold text-gray-900">
                          {new Date(dateStr + 'T00:00:00').getDate()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          POS: {fmt(c.pos_total)} · Actual: {fmt(c.actual_total)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-medium ${variance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Var: {variance >= 0 ? '+' : ''}{fmt(variance)}
                          </span>
                          {c.created_by_name && (
                            <span className="text-xs text-gray-400">by {c.created_by_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.bg} text-white`}>
                        {sc.label}
                      </span>
                      <ArrowRightIcon size={14} className="text-gray-300" />
                    </div>
                  </button>
                )
              })}
          </div>
        </Card>
      )}
    </div>
  )
}

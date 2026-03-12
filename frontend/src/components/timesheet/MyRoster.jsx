import { useState, useEffect, useCallback } from 'react'
import { hrAPI } from '../../services/api'
import { getTodayNZ, formatDateNZ } from '../../utils/date'
import Card from '../ui/Card'
import PageHeader from '../ui/PageHeader'
import Badge from '../ui/Badge'
import { CalendarIcon, ArrowRightIcon } from '../icons'

export default function MyRoster() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('summary') // summary | weekly

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await hrAPI.getMyRoster()
      setData(res.data)
    } catch (err) {
      setError('Failed to load roster')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatShiftTime = (timeStr) => {
    if (!timeStr) return '--:--'
    const parts = timeStr.split(':')
    const h = parseInt(parts[0])
    const m = parts[1]
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${m} ${ampm}`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getDayLabel = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long' })
  }

  const isToday = (dateStr) => {
    return dateStr === getTodayNZ()
  }

  const isTomorrow = (dateStr) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return dateStr === formatDateNZ(tomorrow)
  }

  const ShiftCard = ({ roster, label, accent }) => {
    if (!roster) {
      return (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-gray-900">{label}</h4>
            <Badge variant="neutral">Day Off</Badge>
          </div>
          <p className="text-gray-400 text-sm">No shift scheduled</p>
        </Card>
      )
    }

    return (
      <Card className={`p-5 border-l-4 ${accent}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-gray-900">{label}</h4>
          <Badge variant={roster.is_confirmed ? 'success' : 'warning'}>
            {roster.is_confirmed ? 'Confirmed' : 'Draft'}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{formatShiftTime(roster.shift_start)}</p>
            <p className="text-xs text-gray-400">Start</p>
          </div>
          <div className="text-gray-300 text-lg">
            <ArrowRightIcon size={18} />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{formatShiftTime(roster.shift_end)}</p>
            <p className="text-xs text-gray-400">End</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-lg font-bold text-blue-600">{roster.hours}h</p>
            <p className="text-xs text-gray-400">Duration</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <PageHeader
        icon={CalendarIcon}
        title="My Roster"
        subtitle={
          data?.week_start && data?.week_end
            ? `${data.week_start} ~ ${data.week_end}`
            : 'Your work schedule'
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="text-red-500 text-xs mt-1 underline">Close</button>
        </div>
      )}

      {/* View Toggle */}
      <Card className="p-1 flex">
        <button
          onClick={() => setView('summary')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
            view === 'summary'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Today & Tomorrow
        </button>
        <button
          onClick={() => setView('weekly')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
            view === 'weekly'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          See Weekly
        </button>
      </Card>

      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">Loading roster...</p>
        </Card>
      ) : view === 'summary' ? (
        /* ========== SUMMARY VIEW ========== */
        <div className="space-y-4">
          <ShiftCard
            roster={data?.today}
            label="Today"
            accent="border-emerald-500"
          />
          <ShiftCard
            roster={data?.tomorrow}
            label="Tomorrow"
            accent="border-blue-500"
          />
        </div>
      ) : (
        /* ========== WEEKLY VIEW ========== */
        <div className="space-y-2">
          {data?.weekly && data.weekly.length > 0 ? (
            (() => {
              const rosterMap = {}
              data.weekly.forEach(r => { rosterMap[r.date] = r })

              const weekStart = new Date(data.week_start + 'T00:00:00')
              const days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStart)
                d.setDate(weekStart.getDate() + i)
                return formatDateNZ(d)
              })

              return days.map(date => {
                const roster = rosterMap[date]
                const today = isToday(date)
                const tomorrow = isTomorrow(date)

                return (
                  <Card
                    key={date}
                    className={`p-4 flex items-center justify-between ${
                      today ? 'ring-2 ring-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        today ? 'bg-blue-600 text-white' : tomorrow ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                      </div>
                      <div>
                        <p className={`font-medium ${today ? 'text-blue-600' : 'text-gray-900'}`}>
                          {getDayLabel(date)}
                          {today && <span className="text-xs ml-2 text-blue-600">(Today)</span>}
                          {tomorrow && <span className="text-xs ml-2 text-blue-500">(Tomorrow)</span>}
                        </p>
                        <p className="text-xs text-gray-400">{formatDate(date)}</p>
                      </div>
                    </div>
                    {roster ? (
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatShiftTime(roster.shift_start)} - {formatShiftTime(roster.shift_end)}
                        </p>
                        <p className="text-xs text-gray-400">{roster.hours}h</p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Off</span>
                    )}
                  </Card>
                )
              })
            })()
          ) : (
            <Card className="p-8 text-center">
              <p className="text-gray-500">No shifts scheduled this week</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hrAPI, closingAPI, salesAnalysisAPI } from '../../services/api'
import { getNowNZ, formatDateNZ } from '../../utils/date'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'
import Badge from '../ui/Badge'
import SafetyTasksWidget from '../safety/SafetyTasksWidget'
import {
  CalendarIcon, ClockIcon, CheckCircleIcon, ClipboardIcon,
  ChartIcon, TeamIcon, ShieldIcon, ArrowRightIcon,
  DocumentIcon, MoneyIcon
} from '../icons'

const roleBadge = {
  ADMIN: 'purple',
  MANAGER: 'info',
  SUPERVISOR: 'success',
  SENIOR_STAFF: 'warning',
  STAFF: 'neutral',
}

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [clockInfo, setClockInfo] = useState(null)
  const [rosterInfo, setRosterInfo] = useState(null)
  const [staff, setStaff] = useState([])
  const [weeklyData, setWeeklyData] = useState(null)
  const [pendingClosings, setPendingClosings] = useState([])
  const [recentClosings, setRecentClosings] = useState([])
  const [approvingId, setApprovingId] = useState(null)
  const [upcomingHolidays, setUpcomingHolidays] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clockRes, rosterRes] = await Promise.all([
          hrAPI.getTimesheetToday(),
          hrAPI.getMyRoster(),
        ])
        setClockInfo(clockRes.data)
        setRosterInfo(rosterRes.data)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      }

      // Load staff list
      try {
        const res = await hrAPI.getEmployees()
        const employees = res.data?.results || res.data || []
        setStaff(employees.slice(0, 5)) // Show top 5
      } catch {}

      // Load closings that need approval (SUBMITTED only)
      try {
        const res = await closingAPI.list({})
        const allItems = res.data?.results || res.data || []
        const needApproval = allItems
          .filter(c => c.status === 'SUBMITTED')
          .sort((a, b) => b.closing_date.localeCompare(a.closing_date))
        setRecentClosings(needApproval)
        setPendingClosings(needApproval)
      } catch {}

      // Load this week's closing data for chart
      try {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const monday = new Date(today)
        monday.setDate(today.getDate() + mondayOffset)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)

        const startDate = formatDateNZ(monday)
        const endDate = formatDateNZ(sunday)
        const res = await closingAPI.list({ closing_date__gte: startDate, closing_date__lte: endDate })
        const closings = res.data?.results || res.data || []

        if (closings.length > 0) {
          const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          const revenues = [0, 0, 0, 0, 0, 0, 0]
          closings.forEach(c => {
            const d = new Date(c.closing_date)
            const idx = (d.getDay() + 6) % 7 // Mon=0, Sun=6
            const total = (parseFloat(c.pos_card) || 0) + (parseFloat(c.pos_cash) || 0)
            revenues[idx] = total
          })
          const totalRevenue = revenues.reduce((s, v) => s + v, 0)
          setWeeklyData({ weekDays, revenues, totalRevenue })
        }
      } catch {}

      // Load upcoming holidays
      salesAnalysisAPI.getUpcomingHolidays().then(res => setUpcomingHolidays(res.data?.upcoming)).catch(() => {})
    }
    fetchData()
  }, [])

  const formatShiftTime = (timeStr) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    const h = parseInt(parts[0])
    const m = parts[1]
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${m} ${ampm}`
  }

  const formatClockTime = (datetime) => {
    if (!datetime) return ''
    const d = new Date(datetime)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  // Clock status
  let clockStatusText = 'Not clocked in'
  let clockStatusColor = 'text-gray-400'
  if (clockInfo?.status === 'WORKING') {
    clockStatusText = `Working since ${formatClockTime(clockInfo.timesheet?.check_in)}`
    clockStatusColor = 'text-emerald-600'
  } else if (clockInfo?.status === 'ON_BREAK') {
    clockStatusText = 'On break'
    clockStatusColor = 'text-amber-600'
  } else if (clockInfo?.status === 'CLOCKED_OUT') {
    clockStatusText = `Done — ${clockInfo.timesheet?.worked_hours?.toFixed(1) || 0}h`
    clockStatusColor = 'text-gray-500'
  }

  const handleApproveClosing = async (id) => {
    setApprovingId(id)
    try {
      await closingAPI.approve(id)
      setPendingClosings(prev => prev.filter(c => c.id !== id))
      setRecentClosings(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.error('Approve failed:', err)
    } finally {
      setApprovingId(null)
    }
  }

  const todayShift = rosterInfo?.today
  const maxRev = weeklyData ? Math.max(...weeklyData.revenues, 1) : 1

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Store Overview (Chart + Weekly KPI) */}
      {weeklyData && (
        <>
          <SectionLabel>Store Overview</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Chart */}
            <Card className="lg:col-span-2 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-700">Weekly Revenue</p>
              </div>
              <div className="flex items-end gap-2 h-32">
                {weeklyData.weekDays.map((d, i) => (
                  <div key={d} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end gap-0.5 h-24">
                      <div className="flex-1 bg-blue-500 rounded-t-sm transition-all" style={{ height: `${(weeklyData.revenues[i] / maxRev) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{d}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Weekly KPI */}
            <Card className="p-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Weekly KPI</p>
              {[
                { label: 'Total Revenue', value: fmt(weeklyData.totalRevenue) },
              ].map(k => (
                <div key={k.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-400">{k.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{k.value}</span>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}

      {/* Upcoming Holidays */}
      {upcomingHolidays && upcomingHolidays.length > 0 && (
        <>
          <SectionLabel>Upcoming Holidays</SectionLabel>
          <div className="space-y-4">
            {upcomingHolidays.map((h, i) => {
              const catColors = {
                NZ_PUBLIC: 'bg-blue-100 text-blue-700',
                NZ_SCHOOL: 'bg-purple-100 text-purple-700',
                CN_MAJOR: 'bg-red-100 text-red-700',
              }
              const catCls = catColors[h.category] || 'bg-gray-100 text-gray-700'
              const dDay = h.is_ongoing ? 'NOW' : `D-${h.days_until}`
              const dBadgeCls = h.is_ongoing
                ? 'bg-emerald-500 text-white'
                : h.days_until <= 7
                  ? 'bg-red-500 text-white'
                  : h.days_until <= 30
                    ? 'bg-amber-500 text-white'
                    : 'bg-blue-600 text-white'
              const fmtD = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' })
              const history = h.history || []
              return (
                <Card key={i} className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${dBadgeCls}`}>
                        {dDay}
                      </span>
                      <div>
                        <p className="text-base font-bold text-gray-900">{h.name_ko || h.name}</p>
                        <p className="text-xs text-gray-500">
                          {fmtD(h.start_date)} — {fmtD(h.end_date)} ({h.duration}days)
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catCls}`}>
                      {(h.category || '').replace('NZ_', '').replace('CN_', '').replace('_', ' ')}
                    </span>
                  </div>

                  {/* Past years data */}
                  {history.length > 0 ? (
                    <div className="space-y-2">
                      {/* Column headers */}
                      <div className="grid grid-cols-6 gap-2 text-[10px] font-semibold text-gray-400 uppercase px-1">
                        <span>Year</span>
                        <span className="text-right">Total Sales</span>
                        <span className="text-right">Avg Daily</span>
                        <span className="text-right">Impact</span>
                        <span className="text-right">Staff/Day</span>
                        <span className="text-right">SPLH</span>
                      </div>
                      {history.map((yr, j) => {
                        const isPositive = yr.impact_pct >= 0
                        return (
                          <div key={j} className={`grid grid-cols-6 gap-2 items-center px-2 py-2 rounded-lg text-xs ${j === 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
                            <span className="font-bold text-gray-700">{yr.year}</span>
                            <span className="text-right font-semibold text-gray-900">{fmt(yr.total_sales)}</span>
                            <span className="text-right text-gray-700">{fmt(yr.avg_daily)}</span>
                            <span className={`text-right font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isPositive ? '↑' : '↓'}{Math.abs(yr.impact_pct).toFixed(1)}%
                            </span>
                            <span className="text-right text-gray-700">{yr.avg_staff_per_day}</span>
                            <span className="text-right font-semibold text-gray-900">{fmt(yr.splh)}</span>
                          </div>
                        )
                      })}
                      {/* Detail row for most recent year */}
                      {history[0] && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-1 text-[10px] text-gray-400">
                          <span>Staff: <strong className="text-gray-600">{history[0].staff_count} people</strong></span>
                          <span>Shifts: <strong className="text-gray-600">{history[0].total_shifts}</strong></span>
                          <span>Hours: <strong className="text-gray-600">{history[0].total_hours}h</strong></span>
                          <span>Normal Avg: <strong className="text-gray-600">{fmt(history[0].normal_avg)}</strong></span>
                          <span>Normal SPLH: <strong className="text-gray-600">{fmt(history[0].normal_splh)}</strong></span>
                          <span>Normal Staff: <strong className="text-gray-600">{history[0].normal_staff_avg}/day</strong></span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-2">No historical data available</p>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Safety Tasks Widget */}
      <SafetyTasksWidget />
    </div>
  )
}

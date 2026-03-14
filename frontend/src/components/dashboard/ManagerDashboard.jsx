import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hrAPI, closingAPI } from '../../services/api'
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
      {/* My Shift + Clock Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Shift */}
        <button onClick={() => navigate('/roster')} className="w-full text-left">
          {todayShift ? (
            <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-sm h-full">
              <p className="text-blue-200 text-xs font-medium mb-1">Today's Shift</p>
              <p className="text-2xl font-bold mb-0.5">
                {formatShiftTime(todayShift.shift_start)} – {formatShiftTime(todayShift.shift_end)}
              </p>
              <p className="text-blue-200 text-sm">{user?.organization_detail?.name || ''}</p>
            </div>
          ) : (
            <Card className="p-5 h-full">
              <p className="text-gray-400 text-xs font-medium mb-1">Today's Shift</p>
              <p className="text-xl font-bold text-gray-900 mb-0.5">Day Off</p>
              <p className="text-gray-400 text-sm">No shift scheduled</p>
            </Card>
          )}
        </button>

        {/* Clock Status */}
        <button onClick={() => navigate('/timesheet')} className="w-full text-left">
          <Card className="p-5 h-full">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                clockInfo?.status === 'WORKING' ? 'bg-emerald-100' :
                clockInfo?.status === 'ON_BREAK' ? 'bg-amber-100' :
                'bg-gray-100'
              }`}>
                <ClockIcon size={24} className={
                  clockInfo?.status === 'WORKING' ? 'text-emerald-600' :
                  clockInfo?.status === 'ON_BREAK' ? 'text-amber-600' :
                  'text-gray-400'
                } />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Time Clock</p>
                <p className={`text-sm ${clockStatusColor}`}>{clockStatusText}</p>
              </div>
            </div>
          </Card>
        </button>
      </div>

      {/* Quick Actions — My Work */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'My Roster', path: '/roster', icon: CalendarIcon, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'My Tasks', path: '/tasks', icon: CheckCircleIcon, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: 'Food Safety', path: '/safety', icon: ShieldIcon, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Documents', path: '/documents', icon: DocumentIcon, bg: 'bg-purple-50', color: 'text-purple-600' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} className="text-left">
            <Card className="p-3">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                  <item.icon size={20} className={item.color} />
                </div>
                <p className="font-semibold text-gray-900 text-[11px]">{item.label}</p>
              </div>
            </Card>
          </button>
        ))}
      </div>

      {/* Closings Needing Approval */}
      <div className="flex items-center justify-between">
        <SectionLabel>Needs Approval</SectionLabel>
        <button
          onClick={() => navigate('/closing/monthly')}
          className="text-xs font-medium text-blue-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
        >
          <CalendarIcon size={14} />
          Monthly
        </button>
      </div>
      {recentClosings.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-gray-50">
            {recentClosings.map(c => {
              const variance = parseFloat(c.total_variance || 0)
              const statusMap = {
                DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
                SUBMITTED: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
                APPROVED: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
                REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
              }
              const st = statusMap[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                  <button
                    onClick={() => navigate(`/closing/form?date=${c.closing_date}`)}
                    className="flex items-center gap-4 text-left flex-1 min-w-0"
                  >
                    <div className="text-center w-10 flex-shrink-0">
                      <p className="text-xs text-gray-400">
                        {new Date(c.closing_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Date(c.closing_date + 'T00:00:00').getDate()}
                      </p>
                    </div>
                    <div className="min-w-0">
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
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`}>
                      {st.label}
                    </span>
                    {c.status === 'SUBMITTED' && (
                      <button
                        onClick={() => handleApproveClosing(c.id)}
                        disabled={approvingId === c.id}
                        className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {approvingId === c.id ? '...' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ) : (
        <Card className="p-5 text-center">
          <CheckCircleIcon size={24} className="text-green-500 mx-auto mb-1" />
          <p className="text-sm text-gray-400">All closings approved</p>
        </Card>
      )}

      {/* Safety Tasks Widget */}
      <SafetyTasksWidget />

      {/* Chart + Weekly KPI */}
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

      {/* Staff Table */}
      {staff.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-700">Staff</p>
            <button onClick={() => navigate('/hr')} className="text-xs text-blue-600 font-medium flex items-center gap-1">
              View all <ArrowRightIcon size={14} />
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-50">
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium">Role</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {(s.first_name || s.name || '?')[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{s.first_name || s.name} {s.last_name || ''}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={roleBadge[s.role] || 'neutral'}>
                      {(s.role_display || s.role || '').replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={s.is_active !== false ? 'success' : 'neutral'}>
                      {s.is_active !== false ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Manager Actions */}
      <SectionLabel>Manager</SectionLabel>
      <Card className="p-4 space-y-1">
        {[
          { label: 'Daily Closing', path: '/closing', icon: ClipboardIcon },
          { label: 'Cash Management', path: '/cashup', icon: MoneyIcon },
          { label: 'Reports', path: '/reports', icon: ChartIcon },
          { label: 'Sales Analysis', path: '/sales', icon: ChartIcon },
          { label: 'Roster Management', path: '/manager/roster', icon: CalendarIcon },
          { label: 'Timesheet Review', path: '/manager/timesheet-review', icon: ClockIcon },
          { label: 'Assign Tasks', path: '/manager/assign-tasks', icon: CheckCircleIcon },
          { label: 'HR & Onboarding', path: '/hr', icon: TeamIcon },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <item.icon size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
            </div>
            <ArrowRightIcon size={14} className="text-gray-300" />
          </button>
        ))}
      </Card>
    </div>
  )
}

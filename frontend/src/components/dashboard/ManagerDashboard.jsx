import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hrAPI } from '../../services/api'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'
import Badge from '../ui/Badge'
import SafetyTasksWidget from '../safety/SafetyTasksWidget'
import {
  CalendarIcon, ClockIcon, CheckCircleIcon, ClipboardIcon,
  ChartIcon, TeamIcon, ShieldIcon, WarningIcon, ArrowRightIcon,
  DocumentIcon, MoneyIcon
} from '../icons'

// Placeholder data — replace with API calls later
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const revenues = [420, 380, 490, 510, 620, 890, 530]
const labours = [120, 100, 140, 140, 160, 200, 130]

const staff = [
  { name: 'Sara Kim', role: 'SUPERVISOR', hours: 40, status: 'active' },
  { name: 'John Smith', role: 'STAFF', hours: 24, status: 'active' },
  { name: 'Hikari Q.', role: 'SENIOR_STAFF', hours: 38, status: 'active' },
  { name: 'Tom Lee', role: 'STAFF', hours: 0, status: 'inactive' },
]

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
  const maxRev = Math.max(...revenues)

  const [clockInfo, setClockInfo] = useState(null)
  const [rosterInfo, setRosterInfo] = useState(null)

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

  const todayShift = rosterInfo?.today

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

      {/* Safety Tasks Widget */}
      <SafetyTasksWidget />

      {/* KPI Cards */}
      <SectionLabel>Store Overview</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Today's Revenue" value="$2,840" sub="vs $2,500 yesterday" />
        <KpiCard label="This Week" value="$12,400" sub="Feb 24 – Mar 2" />
        <KpiCard label="Labour Cost" value="$680" alert="24% labour cost" sub="Today" />
        <KpiCard label="Rev / Labour Hr" value="$101" sub="Today" />
      </div>

      {/* Alerts */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => navigate('/manager/timesheet-review')} className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-2 rounded-xl hover:bg-amber-100 transition">
          <WarningIcon size={14} />
          3 timesheets pending approval
        </button>
        <button onClick={() => navigate('/manager/assign-tasks')} className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-2 rounded-xl hover:bg-amber-100 transition">
          <WarningIcon size={14} />
          2 pending tasks
        </button>
        <button onClick={() => navigate('/safety')} className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-2 rounded-xl hover:bg-amber-100 transition">
          <WarningIcon size={14} />
          Food Safety incomplete today
        </button>
      </div>

      {/* Chart + Weekly KPI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Labour Chart */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">Weekly Revenue vs Labour</p>
            <div className="flex gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-300 inline-block" />Labour</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-32">
            {weekDays.map((d, i) => (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-24">
                  <div className="flex-1 bg-blue-500 rounded-t-sm transition-all" style={{ height: `${(revenues[i] / maxRev) * 100}%` }} />
                  <div className="flex-1 bg-rose-300 rounded-t-sm transition-all" style={{ height: `${(labours[i] / maxRev) * 100}%` }} />
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
            { label: 'Total Revenue', value: '$3,840' },
            { label: 'Total Labour', value: '$990' },
            { label: 'Labour %', value: '25.7%', highlight: true },
            { label: 'Rev/Labour Hr', value: '$112' },
            { label: 'Trading Hours', value: '70h' },
          ].map(k => (
            <div key={k.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-400">{k.label}</span>
              <span className={`text-sm font-semibold ${k.highlight ? 'text-emerald-600' : 'text-gray-900'}`}>{k.value}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Staff Table */}
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
              <th className="text-left px-5 py-3 font-medium">This Week</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      {s.name[0]}
                    </div>
                    <span className="font-medium text-gray-900">{s.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={roleBadge[s.role] || 'neutral'}>
                    {s.role.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-16">
                      <div
                        className={`h-1.5 rounded-full ${s.hours >= 40 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(s.hours / 40 * 100, 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${s.hours >= 40 ? 'text-amber-600' : 'text-gray-600'}`}>
                      {s.hours}h
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={s.status === 'active' ? 'success' : 'neutral'}>
                    {s.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Manager Actions */}
      <SectionLabel>Manager</SectionLabel>
      <Card className="p-4 space-y-1">
        {[
          { label: 'Daily Closing', path: '/closing', icon: ClipboardIcon },
          { label: 'Cash Up', path: '/cashup', icon: MoneyIcon },
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

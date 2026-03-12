import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hrAPI } from '../../services/api'
import { getTodayNZ, formatDateNZ } from '../../utils/date'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'
import SafetyTasksWidget from '../safety/SafetyTasksWidget'
import {
  ClockIcon, CheckCircleIcon, ShieldIcon, DocumentIcon, MoneyIcon,
  CalendarIcon, ArrowRightIcon, ClipboardIcon
} from '../icons'

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rosterInfo, setRosterInfo] = useState(null)
  const [clockInfo, setClockInfo] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rosterRes, clockRes] = await Promise.all([
          hrAPI.getMyRoster(),
          hrAPI.getTimesheetToday(),
        ])
        setRosterInfo(rosterRes.data)
        setClockInfo(clockRes.data)
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

  const todayShift = rosterInfo?.today

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

  // Weekly mini schedule
  const weeklyDots = (() => {
    if (!rosterInfo?.weekly) return []
    const weekStart = new Date(rosterInfo.week_start + 'T00:00:00')
    const rosterMap = {}
    rosterInfo.weekly.forEach(r => { rosterMap[r.date] = r })

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      const dateStr = formatDateNZ(d)
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)
      const isToday = dateStr === getTodayNZ()
      return {
        day: dayLabel,
        date: dateStr,
        hasShift: !!rosterMap[dateStr],
        isToday,
        shift: rosterMap[dateStr],
      }
    })
  })()

  return (
    <div className="px-4 pt-2 pb-4 space-y-4">
      {/* Next Shift Card */}
      {todayShift ? (
        <button onClick={() => navigate('/roster')} className="w-full text-left">
          <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-sm">
            <p className="text-blue-200 text-xs font-medium mb-1">Today's Shift</p>
            <p className="text-2xl font-bold mb-0.5">
              {formatShiftTime(todayShift.shift_start)} – {formatShiftTime(todayShift.shift_end)}
            </p>
            <p className="text-blue-200 text-sm">{user?.organization_detail?.name || ''}</p>
            <div className="mt-4 flex gap-2">
              <div className="bg-blue-500/50 rounded-lg px-3 py-1.5 text-xs font-medium">{todayShift.hours}h</div>
              {todayShift.is_confirmed && (
                <div className="bg-blue-500/50 rounded-lg px-3 py-1.5 text-xs font-medium">Confirmed</div>
              )}
            </div>
          </div>
        </button>
      ) : (
        <button onClick={() => navigate('/roster')} className="w-full text-left">
          <Card className="p-5">
            <p className="text-gray-400 text-xs font-medium mb-1">Today's Shift</p>
            <p className="text-xl font-bold text-gray-900 mb-0.5">Day Off</p>
            <p className="text-gray-400 text-sm">No shift scheduled today</p>
          </Card>
        </button>
      )}

      {/* Weekly Mini Schedule */}
      {weeklyDots.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel className="mb-0">This Week</SectionLabel>
            <button onClick={() => navigate('/roster')} className="text-xs text-blue-600 font-medium flex items-center gap-1">
              View all <ArrowRightIcon size={14} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weeklyDots.map((d) => (
              <div key={d.date} className="flex flex-col items-center gap-1">
                <p className="text-xs text-gray-400">{d.day}</p>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-semibold ${
                  d.isToday
                    ? 'ring-2 ring-blue-600 bg-blue-600 text-white'
                    : d.hasShift
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {d.hasShift ? '●' : '–'}
                </div>
                {d.hasShift && d.shift && (
                  <p className="text-gray-400" style={{ fontSize: 9 }}>
                    {formatShiftTime(d.shift.shift_start).replace(' AM', 'a').replace(' PM', 'p')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Clock Status */}
      <button onClick={() => navigate('/timesheet')} className="w-full text-left">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                clockInfo?.status === 'WORKING' ? 'bg-emerald-100' :
                clockInfo?.status === 'ON_BREAK' ? 'bg-amber-100' :
                'bg-gray-100'
              }`}>
                <ClockIcon size={20} className={
                  clockInfo?.status === 'WORKING' ? 'text-emerald-600' :
                  clockInfo?.status === 'ON_BREAK' ? 'text-amber-600' :
                  'text-gray-400'
                } />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Time Clock</p>
                <p className={`text-xs ${clockStatusColor}`}>{clockStatusText}</p>
              </div>
            </div>
            <ArrowRightIcon size={16} className="text-gray-300" />
          </div>
        </Card>
      </button>

      {/* Safety Tasks Widget */}
      <SafetyTasksWidget />

      {/* Quick Actions */}
      <SectionLabel>Quick Actions</SectionLabel>
      <div className="grid grid-cols-4 gap-3">
        {[
          user?.can_daily_close && { label: 'Closing', path: '/closing', icon: ClipboardIcon, bg: 'bg-indigo-50', color: 'text-indigo-600' },
          { label: 'My Roster', path: '/roster', icon: CalendarIcon, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'My Tasks', path: '/tasks', icon: CheckCircleIcon, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: 'Food Safety', path: '/safety', icon: ShieldIcon, bg: 'bg-green-50', color: 'text-green-600' },
        ].filter(Boolean).map(item => (
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
    </div>
  )
}

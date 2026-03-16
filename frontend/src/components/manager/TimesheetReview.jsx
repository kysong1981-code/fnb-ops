import { useState, useEffect, useCallback, useMemo } from 'react'
import { hrAPI } from '../../services/api'
import { getTodayNZ, formatDateNZ, getNowNZ } from '../../utils/date'
import Card from '../ui/Card'
import PageHeader from '../ui/PageHeader'
import Badge from '../ui/Badge'
import KpiCard from '../ui/KpiCard'
import { ClockIcon, ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon } from '../icons'

export default function TimesheetReview() {
  const [timesheets, setTimesheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekRange, setWeekRange] = useState({ start: '', end: '' })
  const [approving, setApproving] = useState(null)

  // Filters
  const [mode, setMode] = useState('week') // 'week' | 'custom'
  const [selectedEmployee, setSelectedEmployee] = useState('') // '' = all
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const getWeekDate = useCallback(() => {
    const now = getNowNZ()
    const day = now.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset + weekOffset * 7)
    return formatDateNZ(monday)
  }, [weekOffset])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (mode === 'week') {
        const date = getWeekDate()
        const res = await hrAPI.getTimesheetWeekly(date)
        setTimesheets(res.data.timesheets || [])
        setWeekRange({ start: res.data.week_start, end: res.data.week_end })
      } else {
        if (!customStart || !customEnd) { setLoading(false); return }
        const res = await hrAPI.getTimesheetRange(customStart, customEnd)
        setTimesheets(res.data.timesheets || res.data || [])
        setWeekRange({ start: customStart, end: customEnd })
      }
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [getWeekDate, mode, customStart, customEnd])

  useEffect(() => { fetchData() }, [fetchData])

  // Extract unique employees from timesheets
  const employees = useMemo(() => {
    const map = {}
    timesheets.forEach(t => {
      const name = t.user_name || t.employee_id
      if (name && !map[name]) map[name] = true
    })
    return Object.keys(map).sort()
  }, [timesheets])

  // Filter by selected employee
  const filtered = useMemo(() => {
    if (!selectedEmployee) return timesheets
    return timesheets.filter(t => (t.user_name || t.employee_id) === selectedEmployee)
  }, [timesheets, selectedEmployee])

  // Group by employee for summary
  const employeeSummary = useMemo(() => {
    const map = {}
    filtered.forEach(t => {
      const name = t.user_name || t.employee_id
      if (!map[name]) map[name] = { hours: 0, days: 0 }
      map[name].hours += t.worked_hours || 0
      map[name].days += 1
    })
    return Object.entries(map).sort((a, b) => b[1].hours - a[1].hours)
  }, [filtered])

  const handleApprove = async (id) => {
    setApproving(id)
    try {
      await hrAPI.approveTimesheet(id)
      await fetchData()
    } catch (err) {
      setError('Failed to approve')
    } finally {
      setApproving(null)
    }
  }

  const handleApproveAll = async () => {
    setApproving('all')
    try {
      const pending = filtered.filter(t => !t.is_approved)
      await Promise.all(pending.map(t => hrAPI.approveTimesheet(t.id)))
      await fetchData()
    } catch (err) {
      setError('Failed to approve all')
    } finally {
      setApproving(null)
    }
  }

  const pendingCount = filtered.filter(t => !t.is_approved).length
  const confirmedCount = filtered.filter(t => t.is_approved).length
  const totalHours = filtered.reduce((sum, t) => sum + (t.worked_hours || 0), 0)

  const formatTime = (datetime) => {
    if (!datetime) return '-'
    const d = new Date(datetime)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <PageHeader
        icon={ClockIcon}
        title="Timesheet Review"
        subtitle={
          weekRange.start && weekRange.end
            ? `${weekRange.start} ~ ${weekRange.end}`
            : 'Review and approve employee work hours'
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="text-red-500 text-xs mt-1 underline">Close</button>
        </div>
      )}

      {/* Mode + Filters */}
      <Card className="p-4 space-y-3">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('week'); setSelectedEmployee('') }}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition ${
              mode === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => { setMode('custom'); setSelectedEmployee('') }}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition ${
              mode === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Week Navigation */}
        {mode === 'week' && (
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setWeekOffset(p => p - 1)}
              className="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              <ChevronLeftIcon size={16} />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition ${
                weekOffset === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setWeekOffset(-1)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition ${
                weekOffset === -1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last Week
            </button>
            <button
              onClick={() => setWeekOffset(p => p + 1)}
              className="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        )}

        {/* Custom Date Range */}
        {mode === 'custom' && (
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">~</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Employee Filter */}
        {employees.length > 0 && (
          <div className="flex gap-2 items-center flex-wrap">
            <button
              onClick={() => setSelectedEmployee('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                !selectedEmployee ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({timesheets.length})
            </button>
            {employees.map(name => {
              const count = timesheets.filter(t => (t.user_name || t.employee_id) === name).length
              return (
                <button
                  key={name}
                  onClick={() => setSelectedEmployee(name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    selectedEmployee === name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {name} ({count})
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Pending" value={pendingCount} alert={pendingCount > 0 ? `${pendingCount} awaiting` : null} />
        <KpiCard label="Approved" value={confirmedCount} />
        <KpiCard label="Total Hours" value={`${totalHours.toFixed(1)}h`} />
        <KpiCard label="Days" value={filtered.length} />
      </div>

      {/* Employee Summary (when viewing all) */}
      {!selectedEmployee && employeeSummary.length > 1 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Employee Summary</h3>
          <div className="space-y-2">
            {employeeSummary.map(([name, data]) => (
              <div
                key={name}
                onClick={() => setSelectedEmployee(name)}
                className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 cursor-pointer transition"
              >
                <span className="text-sm font-medium text-gray-900">{name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">{data.days} days</span>
                  <span className="text-sm font-bold text-blue-600">{data.hours.toFixed(1)}h</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">Loading...</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">{mode === 'custom' && (!customStart || !customEnd) ? 'Select date range' : 'No timesheets found'}</p>
        </Card>
      ) : (
        <>
          {/* Confirm All Button */}
          {pendingCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={handleApproveAll}
                disabled={approving === 'all'}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-2xl transition disabled:bg-gray-300"
              >
                {approving === 'all' ? 'Approving...' : `Approve All (${pendingCount})`}
              </button>
            </div>
          )}

          {/* Timesheet List */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Employee</th>
                    <th className="text-center py-3 px-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Date</th>
                    <th className="text-center py-3 px-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Clock In</th>
                    <th className="text-center py-3 px-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Clock Out</th>
                    <th className="text-center py-3 px-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Hours</th>
                    <th className="text-center py-3 px-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="text-center py-3 px-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {t.user_name || t.employee_id}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">{t.date}</td>
                      <td className="py-3 px-4 text-center text-gray-600">{formatTime(t.check_in)}</td>
                      <td className="py-3 px-4 text-center text-gray-600">{formatTime(t.check_out)}</td>
                      <td className="py-3 px-4 text-center font-medium">{t.worked_hours?.toFixed(1) || 0}h</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={t.is_approved ? 'success' : 'warning'}>
                          {t.is_approved ? 'Approved' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {!t.is_approved ? (
                          <button
                            onClick={() => handleApprove(t.id)}
                            disabled={approving === t.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 px-3 rounded-xl transition disabled:bg-gray-300"
                          >
                            {approving === t.id ? '...' : 'Approve'}
                          </button>
                        ) : (
                          <CheckCircleIcon size={16} className="text-emerald-500 inline" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

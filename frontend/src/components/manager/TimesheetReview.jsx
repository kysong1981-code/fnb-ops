import { useState, useEffect, useCallback } from 'react'
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
  const [approving, setApproving] = useState(null) // id or 'all'

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
      const date = getWeekDate()
      const res = await hrAPI.getTimesheetWeekly(date)
      setTimesheets(res.data.timesheets || [])
      setWeekRange({
        start: res.data.week_start,
        end: res.data.week_end,
      })
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [getWeekDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleApprove = async (id) => {
    setApproving(id)
    try {
      await hrAPI.approveTimesheet(id)
      await fetchData()
    } catch (err) {
      setError('Failed to approve')
      console.error(err)
    } finally {
      setApproving(null)
    }
  }

  const handleApproveAll = async () => {
    setApproving('all')
    try {
      const pending = timesheets.filter((t) => !t.is_approved)
      await Promise.all(pending.map((t) => hrAPI.approveTimesheet(t.id)))
      await fetchData()
    } catch (err) {
      setError('Failed to approve all')
      console.error(err)
    } finally {
      setApproving(null)
    }
  }

  const pendingCount = timesheets.filter((t) => !t.is_approved).length
  const confirmedCount = timesheets.filter((t) => t.is_approved).length
  const totalHours = timesheets.reduce((sum, t) => sum + (t.worked_hours || 0), 0)

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

      {/* Week Selector */}
      <Card className="p-4">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setWeekOffset((p) => p - 1)}
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
            onClick={() => setWeekOffset((p) => p + 1)}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Pending" value={pendingCount} alert={pendingCount > 0 ? `${pendingCount} awaiting` : null} />
        <KpiCard label="Approved" value={confirmedCount} />
        <KpiCard label="Total Hours" value={`${totalHours.toFixed(1)}h`} />
      </div>

      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">Loading...</p>
        </Card>
      ) : timesheets.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">No timesheets this week</p>
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
                  {timesheets.map((t) => (
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

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { hrAPI } from '../../services/api'
import Card from '../ui/Card'
import PageHeader from '../ui/PageHeader'
import { ClockIcon, WarningIcon, CheckCircleIcon } from '../icons'

export default function TimeTracking() {
  const navigate = useNavigate()
  const [clockStatus, setClockStatus] = useState('LOADING')
  const [timesheet, setTimesheet] = useState(null)
  const [scheduledHours, setScheduledHours] = useState(null)
  const [blockers, setBlockers] = useState([])
  const [overtimeInfo, setOvertimeInfo] = useState(null)
  const [overtimeReason, setOvertimeReason] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [breakElapsed, setBreakElapsed] = useState(0)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const timerRef = useRef(null)

  const fetchToday = useCallback(async () => {
    try {
      const res = await hrAPI.getTimesheetToday()
      const data = res.data
      setClockStatus(data.status)
      setTimesheet(data.timesheet)
      setScheduledHours(data.scheduled_hours)
    } catch (err) {
      setError('Failed to load today\'s timesheet')
      setClockStatus('NOT_CLOCKED_IN')
      console.error(err)
    }
  }, [])

  useEffect(() => { fetchToday() }, [fetchToday])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (clockStatus === 'WORKING' && timesheet?.check_in) {
      const update = () => {
        const checkIn = new Date(timesheet.check_in).getTime()
        setElapsed(Math.floor((Date.now() - checkIn) / 1000))
      }
      update()
      timerRef.current = setInterval(update, 1000)
    } else if (clockStatus === 'ON_BREAK' && timesheet?.break_start) {
      const update = () => {
        const now = Date.now()
        setBreakElapsed(Math.floor((now - new Date(timesheet.break_start).getTime()) / 1000))
        if (timesheet.check_in) setElapsed(Math.floor((now - new Date(timesheet.check_in).getTime()) / 1000))
      }
      update()
      timerRef.current = setInterval(update, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [clockStatus, timesheet?.check_in, timesheet?.break_start])

  const handleClockIn = async () => {
    setActionLoading(true); setError('')
    try {
      const res = await hrAPI.clockIn()
      setClockStatus(res.data.status); setTimesheet(res.data.timesheet)
    } catch (err) { setError(err.response?.data?.error || 'Failed to clock in') }
    finally { setActionLoading(false) }
  }

  const handleClockOut = async (reason = '') => {
    setActionLoading(true); setError('')
    try {
      const res = await hrAPI.clockOut(reason ? { overtime_reason: reason } : {})
      setClockStatus(res.data.status); setTimesheet(res.data.timesheet)
      setBlockers([]); setOvertimeInfo(null); setOvertimeReason('')
    } catch (err) {
      if (err.response?.status === 409) {
        const data = err.response.data
        if (data.status === 'BLOCKED') { setClockStatus('BLOCKED'); setBlockers(data.blockers); setTimesheet(data.timesheet) }
        else if (data.status === 'OVERTIME_REQUIRED') { setClockStatus('OVERTIME_REQUIRED'); setOvertimeInfo(data); setTimesheet(data.timesheet) }
      } else { setError(err.response?.data?.error || 'Failed to clock out') }
    } finally { setActionLoading(false) }
  }

  const handleBreakStart = async () => {
    setActionLoading(true); setError('')
    try { const res = await hrAPI.breakStart(); setClockStatus(res.data.status); setTimesheet(res.data.timesheet) }
    catch (err) { setError(err.response?.data?.error || 'Failed to start break') }
    finally { setActionLoading(false) }
  }

  const handleBreakEnd = async () => {
    setActionLoading(true); setError('')
    try { const res = await hrAPI.breakEnd(); setClockStatus(res.data.status); setTimesheet(res.data.timesheet) }
    catch (err) { setError(err.response?.data?.error || 'Failed to end break') }
    finally { setActionLoading(false) }
  }

  const formatTimer = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const formatTime = (dt) => {
    if (!dt) return '--:--'
    return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const STANDARD_BREAK_MINUTES = 30
  const breakMinutes = Math.floor(breakElapsed / 60)
  const isExtraBreak = breakMinutes >= STANDARD_BREAK_MINUTES
  const totalBreakMin = (timesheet?.total_break_minutes || 0) + (clockStatus === 'ON_BREAK' ? breakMinutes : 0)
  const netWorkedSeconds = elapsed - (totalBreakMin * 60)
  const netWorkedHours = Math.max(0, netWorkedSeconds / 3600)

  if (clockStatus === 'LOADING') {
    return (
      <div className="px-4 py-6">
        <Card className="p-12 text-center"><p className="text-gray-500">Loading...</p></Card>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 space-y-5">
      <PageHeader
        title="Time Clock"
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        icon={<ClockIcon size={22} />}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="text-red-500 text-xs mt-1 underline">Close</button>
        </div>
      )}

      {/* NOT CLOCKED IN */}
      {clockStatus === 'NOT_CLOCKED_IN' && (
        <Card className="p-8 text-center space-y-6">
          <div>
            <p className="text-gray-500 text-sm mb-2">You haven't clocked in yet</p>
            {scheduledHours && <p className="text-gray-400 text-xs">Scheduled: {scheduledHours}h today</p>}
          </div>
          <button
            onClick={handleClockIn}
            disabled={actionLoading}
            className="w-44 h-44 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 disabled:bg-gray-400 mx-auto flex items-center justify-center"
          >
            {actionLoading ? 'Clocking In...' : 'TIME IN'}
          </button>
          <p className="text-gray-400 text-xs">Tap to start your shift</p>
        </Card>
      )}

      {/* WORKING */}
      {clockStatus === 'WORKING' && (
        <div className="space-y-4">
          <Card className="p-8 text-center">
            <p className="text-sm text-emerald-600 font-medium mb-1">Working</p>
            <p className="text-5xl font-mono font-bold text-gray-900 mb-2">{formatTimer(elapsed)}</p>
            <p className="text-sm text-gray-400">Clocked in at {formatTime(timesheet?.check_in)}</p>
            {totalBreakMin > 0 && <p className="text-xs text-gray-400 mt-1">Break taken: {totalBreakMin} min</p>}
            <div className="mt-3 flex items-center justify-center gap-4 text-sm">
              <span className="text-gray-500">Net: <strong className="text-gray-900">{netWorkedHours.toFixed(1)}h</strong></span>
              {scheduledHours && <span className="text-gray-500">Scheduled: <strong className="text-gray-900">{scheduledHours}h</strong></span>}
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={handleBreakStart} disabled={actionLoading} className="py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg rounded-2xl shadow-sm transition disabled:bg-gray-400">Break</button>
            <button onClick={() => handleClockOut()} disabled={actionLoading} className="py-4 bg-red-500 hover:bg-red-600 text-white font-bold text-lg rounded-2xl shadow-sm transition disabled:bg-gray-400">Time Out</button>
          </div>
        </div>
      )}

      {/* ON BREAK */}
      {clockStatus === 'ON_BREAK' && (
        <div className="space-y-4">
          <Card className="p-8 text-center">
            <p className="text-sm text-amber-600 font-medium mb-1">On Break</p>
            <p className={`text-5xl font-mono font-bold mb-2 ${isExtraBreak ? 'text-red-600' : 'text-amber-600'}`}>
              {formatTimer(breakElapsed)}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-4 mb-2">
              <div className={`h-2 rounded-full transition-all ${isExtraBreak ? 'bg-red-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (breakMinutes / STANDARD_BREAK_MINUTES) * 100)}%` }} />
            </div>
            <p className="text-xs text-gray-400">
              {isExtraBreak
                ? `${breakMinutes - STANDARD_BREAK_MINUTES} min over standard ${STANDARD_BREAK_MINUTES}-min break`
                : `${STANDARD_BREAK_MINUTES - breakMinutes} min remaining of ${STANDARD_BREAK_MINUTES}-min break`}
            </p>
            <p className="text-sm text-gray-400 mt-3">Shift elapsed: {formatTimer(elapsed)}</p>
          </Card>
          <button onClick={handleBreakEnd} disabled={actionLoading} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg rounded-2xl shadow-sm transition disabled:bg-gray-400">End Break</button>
        </div>
      )}

      {/* BLOCKED */}
      {clockStatus === 'BLOCKED' && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <WarningIcon size={22} className="text-red-500" />
              <h3 className="text-lg font-bold text-gray-900">Cannot Clock Out Yet</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Complete the following before clocking out:</p>
            <div className="space-y-3">
              {blockers.map((blocker, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4">
                  {blocker.type === 'tasks' && (
                    <>
                      <p className="font-medium text-red-800 mb-2">{blocker.message}</p>
                      {blocker.items?.map((task) => (
                        <div key={task.id} className="text-sm text-red-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />{task.title}
                        </div>
                      ))}
                      <button onClick={() => navigate('/tasks')} className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline">Go to My Tasks →</button>
                    </>
                  )}
                  {blocker.type === 'fcp' && (
                    <>
                      <p className="font-medium text-red-800">{blocker.message}</p>
                      <button onClick={() => navigate('/safety/checklists/new')} className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline">Go to FCP Checklist →</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setClockStatus('WORKING'); setBlockers([]) }} className="py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-2xl transition">Back</button>
            <button onClick={() => handleClockOut()} disabled={actionLoading} className="py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-2xl transition disabled:bg-gray-400">Retry Time Out</button>
          </div>
        </div>
      )}

      {/* OVERTIME REQUIRED */}
      {clockStatus === 'OVERTIME_REQUIRED' && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon size={22} className="text-amber-500" />
              <h3 className="text-lg font-bold text-gray-900">Overtime Detected</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Scheduled</span>
                <span className="font-medium text-gray-900">{overtimeInfo?.scheduled_hours || scheduledHours}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Actual Worked</span>
                <span className="font-medium text-amber-600">{overtimeInfo?.actual_hours}h</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-3">Please provide a reason for overtime. Manager approval required.</p>
            <textarea
              value={overtimeReason}
              onChange={(e) => setOvertimeReason(e.target.value)}
              placeholder="Reason for overtime..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setClockStatus('WORKING'); setOvertimeInfo(null); setOvertimeReason('') }} className="py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-2xl transition">Back</button>
            <button onClick={() => { if (overtimeReason.trim()) handleClockOut(overtimeReason.trim()) }} disabled={actionLoading || !overtimeReason.trim()} className="py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-2xl transition disabled:bg-gray-400">
              {actionLoading ? 'Submitting...' : 'Submit & Clock Out'}
            </button>
          </div>
        </div>
      )}

      {/* CLOCKED OUT */}
      {clockStatus === 'CLOCKED_OUT' && timesheet && (
        <Card className="p-6 space-y-4">
          <div className="text-center mb-2">
            <CheckCircleIcon size={48} className="text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900 mt-2">Shift Complete</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Clock In</p>
              <p className="text-lg font-bold text-gray-900">{formatTime(timesheet.check_in)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Clock Out</p>
              <p className="text-lg font-bold text-gray-900">{formatTime(timesheet.check_out)}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Total</p>
              <p className="text-xl font-bold text-blue-600">{timesheet.worked_hours?.toFixed(1) || 0}h</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Break</p>
              <p className="text-xl font-bold text-amber-600">{timesheet.total_break_minutes || 0}m</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Net</p>
              <p className="text-xl font-bold text-emerald-600">{timesheet.worked_hours?.toFixed(1) || 0}h</p>
            </div>
          </div>
          {timesheet.is_overtime && (
            <div className={`rounded-xl p-4 ${timesheet.overtime_approved ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-2">
                {timesheet.overtime_approved
                  ? <CheckCircleIcon size={16} className="text-emerald-600" />
                  : <ClockIcon size={16} className="text-amber-600" />
                }
                <span className={`text-sm font-medium ${timesheet.overtime_approved ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {timesheet.overtime_approved ? 'Overtime Approved' : 'Overtime Pending Approval'}
                </span>
              </div>
              {timesheet.overtime_reason && <p className="text-xs text-gray-500 mt-1">Reason: {timesheet.overtime_reason}</p>}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { payrollAPI } from '../../services/api'

const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'Annual Leave', color: 'bg-blue-100 text-blue-700' },
  { value: 'SICK', label: 'Sick Leave', color: 'bg-red-100 text-red-700' },
  { value: 'BEREAVEMENT', label: 'Bereavement', color: 'bg-gray-100 text-gray-700' },
  { value: 'FAMILY_VIOLENCE', label: 'Family Violence', color: 'bg-purple-100 text-purple-700' },
  { value: 'ALTERNATIVE', label: 'Alternative Holiday', color: 'bg-indigo-100 text-indigo-700' },
]

export default function MyLeave() {
  const [balances, setBalances] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    leave_type: 'ANNUAL',
    start_date: '',
    end_date: '',
    total_hours: '',
    reason: '',
  })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [bRes, rRes] = await Promise.all([
        payrollAPI.getMyLeaveBalances({ year: new Date().getFullYear() }),
        payrollAPI.getMyLeaveRequests(),
      ])
      setBalances(bRes.data.results || bRes.data)
      setRequests(rRes.data.results || rRes.data)
    } catch {}
    setLoading(false)
  }

  const submit = async () => {
    setMsg('')
    try {
      await payrollAPI.createLeaveRequest(form)
      setMsg('Leave request submitted.')
      setShowForm(false)
      setForm({ leave_type: 'ANNUAL', start_date: '', end_date: '', total_hours: '', reason: '' })
      load()
    } catch (err) {
      setMsg(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Error submitting request')
    }
  }

  const cancel = async (id) => {
    if (!confirm('Cancel this leave request?')) return
    try {
      await payrollAPI.cancelLeave(id)
      setMsg('Leave request cancelled.')
      load()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error cancelling')
    }
  }

  const leaveColor = (type) => LEAVE_TYPES.find((t) => t.value === type)?.color || 'bg-gray-100 text-gray-600'

  const statusBadge = (s) => {
    const map = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      APPROVED: 'bg-green-100 text-green-700',
      DECLINED: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-100 text-gray-500',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || ''}`}>{s}</span>
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leave</h1>
          <p className="text-gray-500 text-sm">Leave balances & requests</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Request Leave
        </button>
      </div>

      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">{msg}</div>}

      {/* Balances */}
      {loading ? (
        <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {balances.map((b) => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${leaveColor(b.leave_type)}`}>
                  {b.leave_type_display}
                </span>
                <p className="text-2xl font-bold text-gray-900 mt-2">{b.balance_hours}h</p>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Accrued: {b.accrued_hours}h</span>
                  <span>Used: {b.used_hours}h</span>
                </div>
              </div>
            ))}
            {balances.length === 0 && (
              <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
                No leave balances yet. Contact your manager.
              </div>
            )}
          </div>

          {/* Request Form */}
          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">New Leave Request</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                  <select value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total Hours</label>
                  <input type="number" step="0.5" value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: e.target.value })}
                    placeholder="e.g. 8 for 1 day" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
                  <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Submit</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
              </div>
            </div>
          )}

          {/* My Requests */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">My Requests</h2>
            {requests.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">No leave requests yet.</div>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${leaveColor(r.leave_type)}`}>
                        {r.leave_type_display}
                      </span>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {r.start_date} ~ {r.end_date} ({r.total_hours}h)
                    </p>
                    {r.reason && <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>}
                    {r.decline_reason && (
                      <p className="text-xs text-red-500 mt-0.5">Declined: {r.decline_reason}</p>
                    )}
                    {r.paid_amount > 0 && (
                      <p className="text-xs text-green-600 mt-0.5">Paid: ${parseFloat(r.paid_amount).toFixed(2)}</p>
                    )}
                    {(r.status === 'PENDING' || r.status === 'APPROVED') && (
                      <button
                        onClick={() => cancel(r.id)}
                        className="mt-2 px-3 py-1 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

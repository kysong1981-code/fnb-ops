import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { payrollAPI } from '../../services/api'
const TABS = [
  { id: 'periods', label: 'Pay Periods' },
  { id: 'payslips', label: 'Payslips' },
  { id: 'leave', label: 'Leave' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'filing', label: 'Filing' },
  { id: 'rates', label: 'Rates' },
]

export default function PayrollHub() {
  const [tab, setTab] = useState('periods')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Payroll Management</h1>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-gray-100 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'periods' && <PayPeriodsTab />}
      {tab === 'payslips' && <PayslipsTab />}
      {tab === 'leave' && <LeaveTab />}
      {tab === 'holidays' && <HolidaysTab />}
      {tab === 'filing' && <FilingTab />}
      {tab === 'rates' && <RatesTab />}
    </div>
  )
}


// ──────────────────────────── Pay Periods Tab ────────────────────────────
function PayPeriodsTab() {
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ period_type: 'WEEKLY', start_date: '', end_date: '', payment_date: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await payrollAPI.getPayPeriods()
      setPeriods(res.data.results || res.data)
    } catch {}
    setLoading(false)
  }

  const create = async () => {
    try {
      await payrollAPI.createPayPeriod(form)
      setShowForm(false)
      setForm({ period_type: 'WEEKLY', start_date: '', end_date: '', payment_date: '' })
      load()
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Error creating period')
    }
  }

  const generate = async (id) => {
    setMsg('')
    try {
      const res = await payrollAPI.generatePayslips(id)
      setMsg(res.data.message)
      load()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error generating payslips')
    }
  }

  const finalize = async (id) => {
    if (!confirm('Finalize this pay period? This will lock all payslips.')) return
    try {
      const res = await payrollAPI.finalizePayPeriod(id)
      setMsg(res.data.message)
      load()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error finalizing')
    }
  }

  const statusBadge = (s) => {
    const map = {
      DRAFT: 'bg-gray-100 text-gray-600',
      GENERATED: 'bg-blue-100 text-blue-700',
      FINALIZED: 'bg-green-100 text-green-700',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || ''}`}>{s}</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Pay Periods</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Period
        </button>
      </div>

      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.period_type} onChange={(e) => setForm({ ...form, period_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="WEEKLY">Weekly</option>
                <option value="FORTNIGHTLY">Fortnightly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
              <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : periods.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No pay periods yet.</div>
      ) : (
        <div className="space-y-2">
          {periods.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.start_date} ~ {p.end_date}</p>
                  <p className="text-xs text-gray-400">{p.period_type} | Payment: {p.payment_date}</p>
                </div>
                {statusBadge(p.status)}
              </div>
              <div className="flex gap-2 text-xs">
                <span className="text-gray-500">{p.payslip_count} payslips</span>
                {p.total_net !== '0' && <span className="text-green-600 font-medium">Net: ${parseFloat(p.total_net).toFixed(2)}</span>}
              </div>
              <div className="flex gap-2 mt-3">
                {p.status === 'DRAFT' && (
                  <button onClick={() => generate(p.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                    Generate Payslips
                  </button>
                )}
                {p.status === 'GENERATED' && (
                  <>
                    <button onClick={() => generate(p.id)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200">
                      Regenerate
                    </button>
                    <button onClick={() => finalize(p.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                      Finalize
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ──────────────────────────── Payslips Tab ────────────────────────────
function PayslipsTab() {
  const navigate = useNavigate()
  const [payslips, setPayslips] = useState([])
  const [periods, setPeriods] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPeriods()
  }, [])

  useEffect(() => {
    loadPayslips()
  }, [selectedPeriod])

  const loadPeriods = async () => {
    try {
      const res = await payrollAPI.getPayPeriods()
      const data = res.data.results || res.data
      setPeriods(data)
      if (data.length > 0) setSelectedPeriod(data[0].id)
    } catch {}
  }

  const loadPayslips = async () => {
    if (!selectedPeriod) return
    setLoading(true)
    try {
      const res = await payrollAPI.getPayslips({ pay_period: selectedPeriod })
      setPayslips(res.data.results || res.data)
    } catch {}
    setLoading(false)
  }

  const fmt = (v) => `$${parseFloat(v || 0).toFixed(2)}`

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Payslips</h2>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>{p.start_date} ~ {p.end_date}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : payslips.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No payslips for this period.</div>
      ) : (
        <div className="space-y-2">
          {payslips.map((ps) => (
            <button
              key={ps.id}
              onClick={() => navigate(`/payroll/${ps.id}`)}
              className="w-full bg-white rounded-xl border border-gray-100 p-4 text-left hover:border-blue-200 transition"
            >
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-semibold text-gray-900">{ps.user_name}</p>
                <span className="text-xs text-gray-400">{ps.employee_id}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><p className="text-gray-400">Hours</p><p className="font-medium">{ps.total_hours}h</p></div>
                <div><p className="text-gray-400">Gross</p><p className="font-medium">{fmt(ps.gross_salary)}</p></div>
                <div><p className="text-gray-400">Deductions</p><p className="font-medium text-red-500">{fmt(ps.total_deductions)}</p></div>
                <div><p className="text-gray-400">Net</p><p className="font-bold text-green-600">{fmt(ps.net_salary)}</p></div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


// ──────────────────────────── Leave Tab ────────────────────────────
function LeaveTab() {
  const [balances, setBalances] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [view, setView] = useState('requests')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [bRes, rRes] = await Promise.all([
        payrollAPI.getLeaveBalances({ year: new Date().getFullYear() }),
        payrollAPI.getLeaveRequests({ status: 'PENDING' }),
      ])
      setBalances(bRes.data.results || bRes.data)
      setRequests(rRes.data.results || rRes.data)
    } catch {}
    setLoading(false)
  }

  const approve = async (id) => {
    try {
      await payrollAPI.approveLeave(id)
      setMsg('Leave approved.')
      load()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error approving')
    }
  }

  const decline = async (id) => {
    const reason = prompt('Decline reason (optional):')
    try {
      await payrollAPI.declineLeave(id, { reason: reason || '' })
      setMsg('Leave declined.')
      load()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error declining')
    }
  }

  const leaveColor = {
    ANNUAL: 'bg-blue-100 text-blue-700',
    SICK: 'bg-red-100 text-red-700',
    BEREAVEMENT: 'bg-gray-100 text-gray-700',
    FAMILY_VIOLENCE: 'bg-purple-100 text-purple-700',
    ALTERNATIVE: 'bg-indigo-100 text-indigo-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setView('requests')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === 'requests' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Pending Requests {requests.length > 0 && `(${requests.length})`}
        </button>
        <button onClick={() => setView('balances')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === 'balances' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Balances
        </button>
      </div>

      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">{msg}</div>}

      {loading ? (
        <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : view === 'requests' ? (
        requests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No pending leave requests.</div>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{r.user_name}</p>
                    <p className="text-xs text-gray-400">{r.employee_id}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${leaveColor[r.leave_type] || ''}`}>
                    {r.leave_type_display}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{r.start_date} ~ {r.end_date} ({r.total_hours}h)</p>
                {r.reason && <p className="text-xs text-gray-500 mt-1">{r.reason}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => approve(r.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">Approve</button>
                  <button onClick={() => decline(r.id)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200">Decline</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Balances view - group by employee
        balances.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No leave balances found.</div>
        ) : (
          <div className="space-y-2">
            {balances.map((b) => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{b.user_name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${leaveColor[b.leave_type] || ''}`}>
                    {b.leave_type_display}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{b.balance_hours}h</p>
                  <p className="text-xs text-gray-400">Used: {b.used_hours}h</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}


// ──────────────────────────── Holidays Tab ────────────────────────────
function HolidaysTab() {
  const [holidays, setHolidays] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [year])

  const load = async () => {
    setLoading(true)
    try {
      const res = await payrollAPI.getPublicHolidays({ year })
      setHolidays(res.data.results || res.data)
    } catch {}
    setLoading(false)
  }

  const generateHolidays = async () => {
    try {
      const res = await payrollAPI.generatePublicHolidays({ year })
      setMsg(res.data.message)
      load()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error generating')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Public Holidays</h2>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={generateHolidays} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Generate {year}
        </button>
      </div>

      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">{msg}</div>}

      {loading ? (
        <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : holidays.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <p className="text-gray-400 text-sm mb-3">No holidays generated for {year}.</p>
          <button onClick={generateHolidays} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Generate Now
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {holidays.map((h) => (
              <div key={h.id} className="px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">{h.name}</p>
                  {h.date !== h.observed_date && (
                    <p className="text-xs text-orange-500">Mondayised from {h.date}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{h.observed_date}</p>
                  <p className="text-xs text-gray-400">{h.is_national ? 'National' : h.region}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// ──────────────────────────── Filing Tab ────────────────────────────
function FilingTab() {
  const [filings, setFilings] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await payrollAPI.getFilings()
      setFilings(res.data.results || res.data)
    } catch {}
    setLoading(false)
  }

  const generate = async (id) => {
    try {
      const res = await payrollAPI.generateFiling(id)
      setMsg(res.data.message)
      load()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error generating')
    }
  }

  const download = async (id) => {
    try {
      const res = await payrollAPI.downloadFiling(id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `payday_filing_${id}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setMsg('Error downloading CSV')
    }
  }

  const markFiled = async (id) => {
    const notes = prompt('Filing notes (optional):')
    try {
      await payrollAPI.markFiled(id, { notes: notes || '' })
      setMsg('Marked as filed with IRD.')
      load()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error marking as filed')
    }
  }

  const statusBadge = (s) => {
    const map = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      GENERATED: 'bg-blue-100 text-blue-700',
      FILED: 'bg-green-100 text-green-700',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || ''}`}>{s}</span>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">PayDay Filing (IRD)</h2>
      <p className="text-xs text-gray-500">Must be filed within 2 working days of each payday.</p>

      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">{msg}</div>}

      {loading ? (
        <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
          No filings yet. Finalize a pay period to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {filings.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {f.pay_period_info?.start_date} ~ {f.pay_period_info?.end_date}
                  </p>
                  <p className="text-xs text-gray-400">
                    Payment: {f.pay_period_info?.payment_date} | Due: {f.due_date}
                  </p>
                </div>
                {statusBadge(f.status)}
              </div>
              {f.notes && <p className="text-xs text-gray-500 mb-2">{f.notes}</p>}
              <div className="flex gap-2">
                {f.status === 'PENDING' && (
                  <button onClick={() => generate(f.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                    Generate Data
                  </button>
                )}
                {(f.status === 'GENERATED' || f.status === 'FILED') && (
                  <button onClick={() => download(f.id)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
                    Download CSV
                  </button>
                )}
                {f.status === 'GENERATED' && (
                  <button onClick={() => markFiled(f.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                    Mark as Filed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ──────────────────────────── Rates Tab ────────────────────────────
function RatesTab() {
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ user: '', hourly_rate: '', overtime_multiplier: '1.5' })
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await payrollAPI.getSalaries()
      setSalaries(res.data.results || res.data)
    } catch {}
    setLoading(false)
  }

  const create = async () => {
    try {
      await payrollAPI.createSalary({ ...form, is_active: true, effective_from: new Date().toISOString().split('T')[0] })
      setShowForm(false)
      setForm({ user: '', hourly_rate: '', overtime_multiplier: '1.5' })
      setMsg('Salary rate created.')
      load()
    } catch (err) {
      setMsg(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Salary Rates</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Rate
        </button>
      </div>

      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID</label>
              <input type="number" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })}
                placeholder="User profile ID" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hourly Rate ($)</label>
              <input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">OT Multiplier</label>
              <input type="number" step="0.1" value={form.overtime_multiplier} onChange={(e) => setForm({ ...form, overtime_multiplier: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : salaries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No salary rates configured.</div>
      ) : (
        <div className="space-y-2">
          {salaries.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-gray-900">{s.user_name}</p>
                <p className="text-xs text-gray-400">{s.employee_id}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">${parseFloat(s.hourly_rate).toFixed(2)}/h</p>
                <p className="text-xs text-gray-400">OT: x{s.overtime_multiplier} | {s.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

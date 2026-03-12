import { useState, useEffect } from 'react'
import { hrAPI } from '../../services/api'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'
import { TrashIcon, ClipboardIcon } from '../icons'

const JOB_TITLES = [
  { value: 'STORE_MANAGER', label: 'Store Manager' },
  { value: 'ASSISTANT_MANAGER', label: 'Assistant Manager' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'BARISTA', label: 'Barista' },
  { value: 'HEAD_CHEF', label: 'Head Chef' },
  { value: 'CHEF', label: 'Chef' },
  { value: 'COOK', label: 'Cook' },
  { value: 'KITCHEN_HAND', label: 'Kitchen Hand' },
  { value: 'SERVER', label: 'Server' },
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'ALL_ROUNDER', label: 'All Rounder' },
  { value: 'CLEANER', label: 'Cleaner' },
  { value: 'OTHER', label: 'Other' },
]

const WORK_TYPES = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'SALARY', label: 'Salary' },
  { value: 'VISA_FULL_TIME', label: 'Visa Full Time' },
]

const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

export default function InviteTab() {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState(null) // { email, password, invite_code }

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    job_title: 'BARISTA',
    work_type: 'FULL_TIME',
    hourly_rate: '',
    // IEA fields (Visa Full Time)
    commencement_date: '',
    work_location: '',
    min_hours: '30',
    max_hours: '50',
    reporting_to: 'Director/Management',
  })

  const showIeaFields = ['FULL_TIME', 'PART_TIME', 'VISA_FULL_TIME'].includes(form.work_type)
  const showHoursField = form.work_type !== 'CASUAL'

  const loadInvites = async () => {
    setLoading(true)
    try {
      const res = await hrAPI.getInvites()
      setInvites(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch { setInvites([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadInvites() }, [])

  const showMsg = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.first_name || !form.email || !form.hourly_rate) {
      setError('Name, email, and hourly rate are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await hrAPI.createInvite(form)
      const data = res.data
      // Show generated credentials
      if (data.generated_credentials) {
        setCredentials({
          email: data.generated_credentials.email,
          password: data.generated_credentials.password,
          invite_code: data.invite_code,
        })
      }
      setForm({ first_name: '', last_name: '', email: '', job_title: 'BARISTA', work_type: 'FULL_TIME', hourly_rate: '', commencement_date: '', work_location: '', min_hours: '30', max_hours: '50', reporting_to: 'Director/Management' })
      loadInvites()
      showMsg('Invite sent — account created')
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || err.response?.data?.email?.[0] || 'Failed to create invite')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await hrAPI.deleteInvite(id)
      loadInvites()
    } catch {}
  }

  const handleResend = async (id) => {
    try {
      await hrAPI.resendInvite(id)
      loadInvites()
      showMsg('Invite resent')
    } catch {}
  }

  const copyLink = (code) => {
    const url = `${window.location.origin}/invite/${code}`
    navigator.clipboard.writeText(url)
    showMsg('Link copied')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="space-y-5">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

      {/* Generated Credentials Card */}
      {credentials && (
        <Card className="p-5 border-green-200 bg-green-50/50">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Account Created</h3>
              <p className="text-xs text-gray-500 mt-0.5">Share these credentials with the employee. The account will be activated when they click the invite link.</p>
            </div>
            <button onClick={() => setCredentials(null)} className="p-1 text-gray-400 hover:text-gray-600">
              <span className="text-xs">&#10005;</span>
            </button>
          </div>
          <div className="space-y-2 bg-white rounded-xl p-4 border border-green-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Email</span>
              <span className="text-sm font-mono font-medium text-gray-900">{credentials.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Password</span>
              <span className="text-sm font-mono font-medium text-gray-900">{credentials.password}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`)
                showMsg('Credentials copied')
              }}
              className="flex-1 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
            >
              Copy Credentials
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/invite/${credentials.invite_code}`
                navigator.clipboard.writeText(url)
                showMsg('Invite link copied')
              }}
              className="flex-1 py-2 text-xs font-semibold text-green-600 bg-green-50 rounded-xl hover:bg-green-100 transition border border-green-200"
            >
              Copy Invite Link
            </button>
          </div>
        </Card>
      )}

      {/* Invite Form */}
      <Card className="p-5">
        <SectionLabel>New Invitation</SectionLabel>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">First Name *</label>
              <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="John" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Last Name</label>
              <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Doe" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Job Title *</label>
              <select value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} className={inputCls}>
                {JOB_TITLES.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Work Type *</label>
              <select value={form.work_type} onChange={(e) => setForm({ ...form, work_type: e.target.value })} className={inputCls}>
                {WORK_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Hourly Rate *</label>
            <input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} placeholder="0.00" className={inputCls} />
          </div>

          {/* IEA Contract Details */}
          {showIeaFields && (
            <div className="space-y-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
              <p className="text-xs font-semibold text-blue-700">Contract Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Commencement Date</label>
                  <input type="date" value={form.commencement_date} onChange={(e) => setForm({ ...form, commencement_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Reporting To</label>
                  <input type="text" value={form.reporting_to} onChange={(e) => setForm({ ...form, reporting_to: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Work Location</label>
                <input type="text" value={form.work_location} onChange={(e) => setForm({ ...form, work_location: e.target.value })} placeholder="Store address" className={inputCls} />
              </div>
              {showHoursField && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Min Hours/Week</label>
                    <input type="number" value={form.min_hours} onChange={(e) => setForm({ ...form, min_hours: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Max Hours/Week</label>
                    <input type="number" value={form.max_hours} onChange={(e) => setForm({ ...form, max_hours: e.target.value })} className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !form.first_name || !form.email || !form.hourly_rate}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? 'Sending...' : 'Send Invitation'}
          </button>
        </form>
      </Card>

      {/* Invite List */}
      <Card className="p-5">
        <SectionLabel>Invitations</SectionLabel>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No invitations yet</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => {
              const isExpired = inv.is_expired || inv.status === 'EXPIRED'
              const isAccepted = inv.status === 'ACCEPTED'
              return (
                <div key={inv.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {inv.first_name} {inv.last_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{inv.job_title_display}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{inv.email}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">${parseFloat(inv.hourly_rate).toFixed(2)}/hr</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{formatDate(inv.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isAccepted ? 'bg-green-50 text-green-700' :
                      isExpired ? 'bg-red-50 text-red-600' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {isAccepted ? 'Accepted' : isExpired ? 'Expired' : 'Pending'}
                    </span>
                    {!isAccepted && (
                      <>
                        <button
                          onClick={() => copyLink(inv.invite_code)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Copy invite link"
                        >
                          <ClipboardIcon size={14} />
                        </button>
                        {isExpired && (
                          <button
                            onClick={() => handleResend(inv.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Resend
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

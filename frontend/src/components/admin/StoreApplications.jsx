import { useState, useEffect } from 'react'
import { adminAPI } from '../../services/api'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import { ClipboardIcon } from '../icons'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
]

const STATUS_BADGE = {
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-600',
}

export default function StoreApplications() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [actionLoading, setActionLoading] = useState(null)
  const [credentials, setCredentials] = useState(null) // { email, password }
  const [rejectNotes, setRejectNotes] = useState({}) // { id: notes }
  const [rejectingId, setRejectingId] = useState(null)

  const loadApplications = async () => {
    setLoading(true)
    try {
      const params = statusFilter ? { status: statusFilter } : {}
      const res = await adminAPI.getStoreApplications(params)
      setApplications(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch {
      setApplications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications()
  }, [statusFilter])

  const handleApprove = async (id) => {
    setActionLoading(id)
    try {
      const res = await adminAPI.approveApplication(id)
      if (res.data.generated_credentials) {
        setCredentials(res.data.generated_credentials)
      }
      loadApplications()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id) => {
    setActionLoading(id)
    try {
      await adminAPI.rejectApplication(id, { admin_notes: rejectNotes[id] || '' })
      setRejectingId(null)
      loadApplications()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="space-y-5">
      <PageHeader icon={ClipboardIcon} title="Store Applications" subtitle="Review and manage store opening applications" />

      {/* Credentials Card (shown after approval) */}
      {credentials && (
        <Card className="p-5 border-green-200 bg-green-50/50">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Store & Manager Account Created</h3>
              <p className="text-xs text-gray-500 mt-0.5">Share these credentials with the applicant.</p>
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
          <button
            onClick={() => {
              navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`)
            }}
            className="mt-3 w-full py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
          >
            Copy Credentials
          </button>
        </Card>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
              statusFilter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : applications.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-gray-400">No applications found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{app.store_name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    by {app.applicant_name} &middot; {app.applicant_email}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_BADGE[app.status] || ''}`}>
                  {app.status_display || app.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                {app.store_address && (
                  <div>
                    <span className="text-gray-400">Address</span>
                    <p className="text-gray-700 mt-0.5">{app.store_address}</p>
                  </div>
                )}
                {app.applicant_phone && (
                  <div>
                    <span className="text-gray-400">Phone</span>
                    <p className="text-gray-700 mt-0.5">{app.applicant_phone}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Applied</span>
                  <p className="text-gray-700 mt-0.5">{formatDate(app.created_at)}</p>
                </div>
                {app.desired_modules && (
                  <div>
                    <span className="text-gray-400">Modules</span>
                    <p className="text-gray-700 mt-0.5">{app.desired_modules.length} selected</p>
                  </div>
                )}
              </div>

              {app.admin_notes && (
                <div className="text-xs bg-gray-50 rounded-lg p-3 mb-3">
                  <span className="text-gray-400">Admin Notes:</span>
                  <p className="text-gray-600 mt-0.5">{app.admin_notes}</p>
                </div>
              )}

              {app.status === 'PENDING' && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleApprove(app.id)}
                    disabled={actionLoading === app.id}
                    className="px-4 py-2 text-xs font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {actionLoading === app.id ? 'Processing...' : 'Approve'}
                  </button>
                  {rejectingId === app.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={rejectNotes[app.id] || ''}
                        onChange={(e) => setRejectNotes({ ...rejectNotes, [app.id]: e.target.value })}
                        placeholder="Rejection reason (optional)"
                        className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                      <button
                        onClick={() => handleReject(app.id)}
                        disabled={actionLoading === app.id}
                        className="px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setRejectingId(null)}
                        className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRejectingId(app.id)}
                      className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition"
                    >
                      Reject
                    </button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

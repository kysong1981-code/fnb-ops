import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, hrAPI, payrollAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { DocumentIcon, EditIcon, CheckCircleIcon } from '../icons'
import DocumentSigningView from '../hr/DocumentSigningView'

const TABS = [
  { id: 'info', label: 'My Info', icon: '👤' },
  { id: 'docs', label: 'Documents', icon: '📄' },
  { id: 'inquiries', label: 'Inquiries', icon: '💬' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

const INQUIRY_CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'PAY', label: 'Pay & Payslip' },
  { value: 'SCHEDULE', label: 'Schedule & Roster' },
  { value: 'LEAVE', label: 'Leave' },
  { value: 'OTHER', label: 'Other' },
]

/* ───── Editable Info Row ───── */
function InfoRow({ label, value, editable, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')

  useEffect(() => { setDraft(value || '') }, [value])

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={() => { onSave(draft); setEditing(false) }}
          className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save</button>
        <button onClick={() => { setDraft(value || ''); setEditing(false) }}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1">{value || '-'}</span>
      {editable && (
        <button onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition">
          <EditIcon size={14} />
        </button>
      )}
    </div>
  )
}

/* ───── Main: My Page ───── */
export default function MyPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [activeTab, setActiveTab] = useState('info')

  // Profile
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Leave balances
  const [leaveBalances, setLeaveBalances] = useState([])

  // Documents
  const [documents, setDocuments] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [viewingDoc, setViewingDoc] = useState(null)

  // Inquiries
  const [inquiries, setInquiries] = useState([])
  const [inqLoading, setInqLoading] = useState(false)
  const [inqForm, setInqForm] = useState({ category: 'GENERAL', subject: '', message: '' })
  const [inqSubmitting, setInqSubmitting] = useState(false)
  const [expandedInq, setExpandedInq] = useState(null)

  // Settings
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  // Toast
  const [toast, setToast] = useState('')
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Load profile + leave on mount ──
  useEffect(() => {
    const load = async () => {
      try {
        const [profRes, leaveRes] = await Promise.all([
          authAPI.getProfile(),
          payrollAPI.getMyLeaveBalances().catch(() => ({ data: [] })),
        ])
        setProfile(profRes.data.profile)
        setLeaveBalances(Array.isArray(leaveRes.data) ? leaveRes.data : [])
      } catch (err) {
        console.error('Failed to load profile', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Lazy-load docs ──
  useEffect(() => {
    if (activeTab === 'docs' && documents.length === 0 && !docsLoading) {
      setDocsLoading(true)
      hrAPI.getMyDocuments().then(r => setDocuments(r.data)).catch(() => {}).finally(() => setDocsLoading(false))
    }
  }, [activeTab])

  // ── Lazy-load inquiries ──
  useEffect(() => {
    if (activeTab === 'inquiries' && inquiries.length === 0 && !inqLoading) loadInquiries()
  }, [activeTab])

  const loadInquiries = async () => {
    setInqLoading(true)
    try { const r = await hrAPI.getInquiries(); setInquiries(r.data) } catch {}
    setInqLoading(false)
  }

  // ── Actions ──
  const handleProfileUpdate = async (field, value) => {
    try {
      const res = await authAPI.updateProfile({ [field]: value })
      setProfile(res.data.profile)
      showToast('Updated successfully')
    } catch { showToast('Failed to update') }
  }

  const handlePasswordChange = async () => {
    setPwErr(''); setPwMsg('')
    if (pwForm.newPw !== pwForm.confirm) { setPwErr('New passwords do not match'); return }
    if (pwForm.newPw.length < 6) { setPwErr('Password must be at least 6 characters'); return }
    setPwSaving(true)
    try {
      await authAPI.changePassword({ current_password: pwForm.current, new_password: pwForm.newPw })
      setPwMsg('Password changed successfully')
      setPwForm({ current: '', newPw: '', confirm: '' })
    } catch (err) { setPwErr(err.response?.data?.error || 'Failed to change password') }
    setPwSaving(false)
  }

  const handleSubmitInquiry = async () => {
    if (!inqForm.subject.trim() || !inqForm.message.trim()) return
    setInqSubmitting(true)
    try {
      await hrAPI.createInquiry(inqForm)
      setInqForm({ category: 'GENERAL', subject: '', message: '' })
      showToast('Inquiry submitted')
      loadInquiries()
    } catch { showToast('Failed to submit') }
    setInqSubmitting(false)
  }

  const handleLogout = () => { logout(); navigate('/login') }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const p = profile || {}
  const initials = `${(p.user?.first_name || '')[0] || ''}${(p.user?.last_name || '')[0] || ''}`.toUpperCase() || '?'
  const fullName = p.user ? `${p.user.first_name} ${p.user.last_name}`.trim() : ''

  // ── Document Signing overlay ──
  if (viewingDoc) {
    return (
      <DocumentSigningView
        docId={viewingDoc.id} taskId={null} docTitle={viewingDoc.title}
        onComplete={() => { setViewingDoc(null); hrAPI.getMyDocuments().then(r => setDocuments(r.data)).catch(() => {}) }}
        onCancel={() => setViewingDoc(null)}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Hero Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold">{initials}</div>
          <div>
            <h2 className="text-lg font-bold">{fullName || 'Employee'}</h2>
            <p className="text-blue-100 text-sm">{p.job_title_display || p.role_display || ''} · {p.employee_id || ''}</p>
            <p className="text-blue-200 text-xs mt-0.5">{p.organization_detail?.name || ''}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span className="hidden sm:inline mr-1">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ Tab 1: My Info ═══════ */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800">Personal Information</h3>
            <InfoRow label="Email" value={p.user?.email} editable onSave={v => handleProfileUpdate('email', v)} />
            <InfoRow label="Phone" value={p.phone} editable onSave={v => handleProfileUpdate('phone', v)} />
            <InfoRow label="Date of Birth" value={p.date_of_birth} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800">Employment Details</h3>
            <InfoRow label="Job Title" value={p.job_title_display} />
            <InfoRow label="Work Type" value={p.work_type_display} />
            <InfoRow label="Status" value={p.employment_status_display} />
            <InfoRow label="Joined" value={p.date_of_joining} />
            <InfoRow label="Role" value={p.role_display} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800">Tax & Banking</h3>
            <InfoRow label="IRD Number" value={p.tax_file_number} />
            <InfoRow label="KiwiSaver" value={p.kiwisaver_status === 'OPT_IN' ? `Opted In (${p.kiwisaver_rate})` : p.kiwisaver_status} />
            <InfoRow label="Bank Account" value={p.bank_account} editable onSave={v => handleProfileUpdate('bank_account', v)} />
          </div>

          {leaveBalances.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">Leave Balances</h3>
                <button onClick={() => navigate('/leave')} className="text-xs text-blue-600 hover:text-blue-700 font-semibold">View All →</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {leaveBalances.slice(0, 4).map((lb, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">{lb.leave_type_display}</p>
                    <p className="text-lg font-bold text-gray-900">{lb.balance_hours || 0}h</p>
                    <p className="text-[10px] text-gray-400">remaining</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ Tab 2: Documents ═══════ */}
      {activeTab === 'docs' && (
        <div className="space-y-3">
          {docsLoading ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          ) : documents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <DocumentIcon size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No documents yet</p>
            </div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <DocumentIcon size={20} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-400">{doc.document_type} · {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.is_signed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                      <CheckCircleIcon size={12} /> Signed
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700">Pending</span>
                  )}
                  <button onClick={() => setViewingDoc(doc)}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">View</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════ Tab 3: Inquiries ═══════ */}
      {activeTab === 'inquiries' && (
        <div className="space-y-4">
          {/* New Inquiry Form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800">New Inquiry</h3>
            <select value={inqForm.category} onChange={e => setInqForm(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {INQUIRY_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input placeholder="Subject" value={inqForm.subject}
              onChange={e => setInqForm(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea placeholder="Your message..." rows={3} value={inqForm.message}
              onChange={e => setInqForm(prev => ({ ...prev, message: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <button onClick={handleSubmitInquiry}
              disabled={inqSubmitting || !inqForm.subject.trim() || !inqForm.message.trim()}
              className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition">
              {inqSubmitting ? 'Submitting...' : 'Submit Inquiry'}
            </button>
          </div>

          {/* Inquiry List */}
          <h3 className="text-sm font-bold text-gray-800">My Inquiries</h3>
          {inqLoading ? (
            <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
          ) : inquiries.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No inquiries yet</p>
          ) : (
            <div className="space-y-2">
              {inquiries.map(inq => {
                const sc = { PENDING: 'bg-yellow-100 text-yellow-700', REPLIED: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-100 text-gray-500' }
                const open = expandedInq === inq.id
                return (
                  <div key={inq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <button onClick={() => setExpandedInq(open ? null : inq.id)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${sc[inq.status] || ''}`}>{inq.status_display}</span>
                          <span className="text-[10px] text-gray-400">{inq.category_display}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 truncate">{inq.subject}</p>
                        <p className="text-xs text-gray-400">{new Date(inq.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Your message:</p>
                          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{inq.message}</p>
                        </div>
                        {inq.reply && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Reply from {inq.replied_by_name || 'Manager'}{inq.replied_at && ` · ${new Date(inq.replied_at).toLocaleDateString()}`}</p>
                            <p className="text-sm text-gray-700 bg-green-50 rounded-lg p-3 border border-green-100">{inq.reply}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════ Tab 4: Settings ═══════ */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800">Change Password</h3>
            <input type="password" placeholder="Current password" value={pwForm.current}
              onChange={e => setPwForm(prev => ({ ...prev, current: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="password" placeholder="New password" value={pwForm.newPw}
              onChange={e => setPwForm(prev => ({ ...prev, newPw: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="password" placeholder="Confirm new password" value={pwForm.confirm}
              onChange={e => setPwForm(prev => ({ ...prev, confirm: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {pwErr && <p className="text-xs text-red-600">{pwErr}</p>}
            {pwMsg && <p className="text-xs text-green-600">{pwMsg}</p>}
            <button onClick={handlePasswordChange} disabled={pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm}
              className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition">
              {pwSaving ? 'Saving...' : 'Change Password'}
            </button>
          </div>

          <button onClick={handleLogout}
            className="w-full py-3 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-2xl hover:bg-red-100 transition">
            Logout
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

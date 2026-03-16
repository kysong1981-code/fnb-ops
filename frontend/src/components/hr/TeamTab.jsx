import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hrAPI } from '../../services/api'
import Card from '../ui/Card'
import { XIcon, DocumentIcon } from '../icons'

const STATUS_FILTERS = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'LEAVE', label: 'On Leave' },
  { key: 'RESIGNED', label: 'Resigned' },
  { key: 'TERMINATED', label: 'Terminated' },
  { key: 'ALL', label: 'All' },
]

const JOB_TITLES = [
  { value: '', label: '— Not Set —' },
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

const fmt = (v) => v != null ? `$${parseFloat(v).toFixed(2)}` : '-'

export default function TeamTab() {
  const navigate = useNavigate()
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ACTIVE')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [newRate, setNewRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [resettingPw, setResettingPw] = useState(null)
  const [resetResult, setResetResult] = useState(null)
  const [permSaving, setPermSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(null)
  const [noteForm, setNoteForm] = useState({ subject: '', content: '', category: 'MEETING' })
  const [noteSaving, setNoteSaving] = useState(false)
  const [isComposing, setIsComposing] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const loadTeam = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const params = { status: filter }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      const res = await hrAPI.getTeam(params)
      setTeam(res.data)
    } catch { setTeam([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadTeam(true) }, [filter, searchQuery])

  const loadDetail = async (id) => {
    setDetailLoading(true)
    try {
      const res = await hrAPI.getTeamMember(id)
      setDetail(res.data)
    } catch { setDetail(null) }
    finally { setDetailLoading(false) }
  }

  const handleSelect = (member) => {
    if (selected === member.profile_id) {
      setSelected(null)
      setDetail(null)
    } else {
      setSelected(member.profile_id)
      loadDetail(member.profile_id)
    }
    setNewRate('')
  }

  const handleResetPassword = async (profileId) => {
    if (!confirm('Reset this employee\'s password? A new temporary password will be emailed to them.')) return
    setResettingPw(profileId)
    setResetResult(null)
    try {
      const res = await hrAPI.resetPassword(profileId)
      setResetResult(res.data)
    } catch (err) {
      setResetResult({ message: 'Failed to reset password', error: true })
    } finally {
      setResettingPw(null)
    }
  }

  const handleTogglePermission = async (field) => {
    if (!selected || !detail) return
    const newVal = !detail[field]
    // Optimistic update
    setDetail(prev => ({ ...prev, [field]: newVal }))
    setPermSaving(true)
    try {
      const res = await hrAPI.updatePermissions(selected, { [field]: newVal })
      setDetail(prev => ({ ...prev, ...res.data }))
    } catch (err) {
      // Revert on error
      console.error('Permission update failed:', err)
      setDetail(prev => ({ ...prev, [field]: !newVal }))
    }
    finally { setPermSaving(false) }
  }

  const handleToggleAllowanceAmount = async (field, value) => {
    if (!selected || !detail) return
    setPermSaving(true)
    try {
      const res = await hrAPI.updatePermissions(selected, { [field]: value })
      setDetail(prev => ({ ...prev, ...res.data }))
    } catch (err) {
      console.error('Amount update failed:', err)
    }
    finally { setPermSaving(false) }
  }

  const handleUpdateSalary = async () => {
    if (!newRate || !selected) return
    setSaving(true)
    try {
      const payload = { hourly_rate: newRate }
      if (effectiveDate) payload.effective_from = effectiveDate
      await hrAPI.updateSalary(selected, payload)
      setNewRate('')
      setEffectiveDate('')
      loadDetail(selected)
      loadTeam()
    } catch {}
    finally { setSaving(false) }
  }

  const handleSaveNote = async () => {
    if (!noteForm.subject || !noteForm.content || !showNoteModal) return
    setNoteSaving(true)
    try {
      await hrAPI.createEmployeeNote({
        employee: showNoteModal,
        category: noteForm.category,
        date: new Date().toISOString().split('T')[0],
        subject: noteForm.subject,
        content: noteForm.content,
      })
      setShowNoteModal(null)
      setNoteForm({ subject: '', content: '', category: 'MEETING' })
    } catch {}
    finally { setNoteSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              setSearchQuery(search.trim())
            }
          }}
          placeholder="Search and press Enter..."
          className="w-full px-4 py-2.5 pl-10 pr-20 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {search && (
            <button onClick={() => { setSearch(''); setSearchQuery('') }} className="text-gray-400 hover:text-gray-600 p-1">
              <XIcon size={14} />
            </button>
          )}
          <button
            onClick={() => setSearchQuery(search.trim())}
            className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-lg hover:bg-gray-200"
          >
            Search
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setSelected(null); setDetail(null) }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filter === f.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-gray-400 self-center ml-2">{team.length} members</span>
      </div>

      {/* Team List */}
      {team.length === 0 ? (
        <Card className="p-8 text-center text-gray-400 text-sm">No team members found</Card>
      ) : (
        <Card>
          <div className="divide-y divide-gray-50">
            {team.map((m) => (
              <div key={m.profile_id}>
                <button
                  onClick={() => handleSelect(m)}
                  className={`w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition ${
                    selected === m.profile_id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                      {m.employment_status && m.employment_status !== 'ACTIVE' && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          m.employment_status === 'RESIGNED' ? 'bg-gray-100 text-gray-500' :
                          m.employment_status === 'TERMINATED' ? 'bg-red-100 text-red-600' :
                          m.employment_status === 'LEAVE' || m.employment_status === 'ON_LEAVE' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {m.employment_status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{m.job_title_display || m.role_display}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{m.work_type_display}</span>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-semibold text-gray-900">{fmt(m.hourly_rate)}</p>
                    <p className="text-xs text-gray-400">/hr</p>
                  </div>
                </button>

                {/* Expanded Detail */}
                {selected === m.profile_id && (
                  <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                    {detailLoading ? (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : detail ? (
                      <div className="space-y-4">
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/hr/employee-file/${m.profile_id}`)}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                          >
                            Employee File
                          </button>
                          <button
                            onClick={() => { setShowNoteModal(m.profile_id); setNoteForm({ subject: '', content: '', category: 'MEETING' }) }}
                            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm"
                          >
                            + Meeting Note
                          </button>
                        </div>
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-xs text-gray-400">Job Title</span>
                            <select
                              value={detail.job_title || ''}
                              onChange={async (e) => {
                                const val = e.target.value
                                try {
                                  const res = await hrAPI.updatePermissions(selected, { job_title: val })
                                  setDetail({ ...detail, ...res.data })
                                  loadTeam()
                                } catch {}
                              }}
                              className="w-full mt-0.5 text-sm text-gray-900 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {JOB_TITLES.map(j => (
                                <option key={j.value} value={j.value}>{j.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Employee ID</span>
                            <p className="text-gray-900">{detail.employee_id}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Email</span>
                            <p className="text-gray-900">{detail.email || '-'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Phone</span>
                            <p className="text-gray-900">{detail.phone || '-'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Work Type</span>
                            <select
                              value={detail.work_type || ''}
                              onChange={async (e) => {
                                setPermSaving(true)
                                try {
                                  const res = await hrAPI.updatePermissions(selected, { work_type: e.target.value })
                                  setDetail({ ...detail, ...res.data })
                                } catch {}
                                finally { setPermSaving(false) }
                              }}
                              className="mt-0.5 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="FULL_TIME">Full Time</option>
                              <option value="PART_TIME">Part Time</option>
                              <option value="CASUAL">Casual</option>
                              <option value="SALARY">Salary</option>
                              <option value="SALARY_FULLTIME">Salary Full Time</option>
                              <option value="VISA_FULL_TIME">Visa Full Time</option>
                            </select>
                            {detail.work_type === 'SALARY_FULLTIME' && (
                              <div className="mt-2">
                                <span className="text-xs text-gray-400">Annual Salary (NZD)</span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-sm text-gray-400">$</span>
                                  <input
                                    type="number"
                                    step="1000"
                                    value={detail.annual_salary || ''}
                                    onChange={(e) => setDetail({ ...detail, annual_salary: e.target.value })}
                                    onBlur={(e) => {
                                      if (e.target.value) handleToggleAllowanceAmount('annual_salary', e.target.value)
                                    }}
                                    placeholder="62000"
                                    className="w-32 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <span className="text-xs text-gray-400">/yr</span>
                                  {detail.annual_salary > 0 && (
                                    <span className="text-xs text-green-600 ml-1">
                                      (${(parseFloat(detail.annual_salary) / 52).toFixed(2)}/wk)
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Joined</span>
                            <p className="text-gray-900">{detail.date_of_joining}</p>
                          </div>
                        </div>

                        {/* Password Reset */}
                        <div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleResetPassword(m.profile_id)}
                              disabled={resettingPw === m.profile_id}
                              className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 transition"
                            >
                              {resettingPw === m.profile_id ? 'Resetting...' : 'Reset Password'}
                            </button>
                            {resetResult && selected === m.profile_id && (
                              <span className={`text-xs ${resetResult.error ? 'text-red-600' : 'text-green-600'}`}>
                                {resetResult.message}
                                {resetResult.temp_password && (
                                  <span className="ml-1 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{resetResult.temp_password}</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Salary Management */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Hourly Rate</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{fmt(detail.hourly_rate)}</span>
                            <span className="text-xs text-gray-400">/hr</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="number"
                              step="0.01"
                              value={newRate}
                              onChange={(e) => setNewRate(e.target.value)}
                              placeholder="New rate"
                              className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="date"
                              value={effectiveDate}
                              onChange={(e) => setEffectiveDate(e.target.value)}
                              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleUpdateSalary}
                              disabled={!newRate || saving}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              {saving ? '...' : 'Update'}
                            </button>
                          </div>
                          {!effectiveDate && newRate && (
                            <p className="text-[10px] text-gray-400 mt-1">No date selected — applies from today</p>
                          )}
                        </div>

                        {/* Permissions */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Permissions</h4>
                          <div className="flex gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={detail.can_daily_close || false}
                                onChange={() => handleTogglePermission('can_daily_close')}
                                disabled={permSaving}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Daily Close</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={detail.can_safety_tasks || false}
                                onChange={() => handleTogglePermission('can_safety_tasks')}
                                disabled={permSaving}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Safety Tasks</span>
                            </label>
                            {permSaving && <span className="text-xs text-gray-400">Saving...</span>}
                          </div>
                        </div>

                        {/* Allowances */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Allowances (Weekly)</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 cursor-pointer min-w-[140px]">
                                <input
                                  type="checkbox"
                                  checked={detail.housing_support || false}
                                  onChange={() => handleTogglePermission('housing_support')}
                                  disabled={permSaving}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Housing</span>
                              </label>
                              {detail.housing_support && (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm text-gray-400">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={detail.housing_amount || ''}
                                    onChange={(e) => setDetail({ ...detail, housing_amount: e.target.value })}
                                    onBlur={(e) => {
                                      if (e.target.value) handleToggleAllowanceAmount('housing_amount', e.target.value)
                                    }}
                                    placeholder="0.00"
                                    className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <span className="text-xs text-gray-400">/wk</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 cursor-pointer min-w-[140px]">
                                <input
                                  type="checkbox"
                                  checked={detail.transport_support || false}
                                  onChange={() => handleTogglePermission('transport_support')}
                                  disabled={permSaving}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Transport</span>
                              </label>
                              {detail.transport_support && (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm text-gray-400">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={detail.transport_amount || ''}
                                    onChange={(e) => setDetail({ ...detail, transport_amount: e.target.value })}
                                    onBlur={(e) => {
                                      if (e.target.value) handleToggleAllowanceAmount('transport_amount', e.target.value)
                                    }}
                                    placeholder="0.00"
                                    className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <span className="text-xs text-gray-400">/wk</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Salary History */}
                        {detail.salary_history?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Rate History</h4>
                            <div className="space-y-1">
                              {detail.salary_history.map((s) => (
                                <div key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                                  <span className="text-gray-500">{s.effective_from}</span>
                                  <span className={`font-medium ${s.is_active ? 'text-blue-600' : 'text-gray-400'}`}>
                                    ${parseFloat(s.hourly_rate).toFixed(2)}
                                    {s.is_active && <span className="ml-1 text-xs">(current)</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Documents */}
                        {detail.documents?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Documents</h4>
                            <div className="space-y-1">
                              {detail.documents.map((d) => (
                                <div key={d.id} className="flex items-center gap-2 py-1.5">
                                  <DocumentIcon size={14} className="text-gray-400" />
                                  <span className="text-sm text-gray-900 flex-1">{d.title}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    d.is_signed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {d.is_signed ? 'Signed' : 'Pending'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Onboarding Status */}
                        {detail.onboarding_status && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Onboarding:</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              detail.onboarding_status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                              detail.onboarding_status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {detail.onboarding_status.replace('_', ' ')}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-2">Failed to load details</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Meeting Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Add Meeting Note</h3>
              <button onClick={() => setShowNoteModal(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={20} />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Category</label>
              <select
                value={noteForm.category}
                onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MEETING">Meeting</option>
                <option value="RETURN_TO_WORK">Return to Work</option>
                <option value="COMPLAINT">Complaint</option>
                <option value="GRIEVANCE">Grievance</option>
                <option value="GENERAL">General</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Subject</label>
              <input
                type="text"
                value={noteForm.subject}
                onChange={(e) => setNoteForm({ ...noteForm, subject: e.target.value })}
                placeholder="e.g. Performance discussion, Return to work..."
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Content</label>
              <textarea
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                rows={5}
                placeholder="Meeting details, discussion points, agreed actions..."
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNoteModal(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                disabled={!noteForm.subject || !noteForm.content || noteSaving}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-semibold"
              >
                {noteSaving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

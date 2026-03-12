import { useState, useEffect } from 'react'
import { hrAPI } from '../../services/api'
import Card from '../ui/Card'
import { XIcon, DocumentIcon } from '../icons'

const STATUS_FILTERS = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'LEAVE', label: 'On Leave' },
  { key: 'ALL', label: 'All' },
]

const fmt = (v) => v != null ? `$${parseFloat(v).toFixed(2)}` : '-'

export default function TeamTab() {
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

  const loadTeam = async () => {
    setLoading(true)
    try {
      const res = await hrAPI.getTeam({ status: filter })
      setTeam(res.data)
    } catch { setTeam([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadTeam() }, [filter])

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

  const handleUpdateSalary = async () => {
    if (!newRate || !selected) return
    setSaving(true)
    try {
      await hrAPI.updateSalary(selected, { hourly_rate: newRate })
      setNewRate('')
      loadDetail(selected)
      loadTeam()
    } catch {}
    finally { setSaving(false) }
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
      {/* Filters */}
      <div className="flex gap-1.5">
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
                    <p className="text-sm font-semibold text-gray-900">{m.name}</p>
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
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
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
                            <div className="flex-1" />
                            <input
                              type="number"
                              step="0.01"
                              value={newRate}
                              onChange={(e) => setNewRate(e.target.value)}
                              placeholder="New rate"
                              className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleUpdateSalary}
                              disabled={!newRate || saving}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              {saving ? '...' : 'Update'}
                            </button>
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
    </div>
  )
}

import { useState, useEffect } from 'react'
import { hrAPI } from '../../services/api'

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  REPLIED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

const CATEGORY_COLORS = {
  GENERAL: 'bg-blue-50 text-blue-600',
  PAY: 'bg-purple-50 text-purple-600',
  SCHEDULE: 'bg-cyan-50 text-cyan-600',
  OTHER: 'bg-gray-50 text-gray-600',
}

const RESIGN_STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
}

export default function InquiriesManager() {
  const [view, setView] = useState('inquiries') // 'inquiries' | 'resignations'

  // Inquiries state
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [filter, setFilter] = useState('ALL')

  // Resignations state
  const [resignations, setResignations] = useState([])
  const [resignLoading, setResignLoading] = useState(false)
  const [selectedResignId, setSelectedResignId] = useState(null)
  const [confirmLastDay, setConfirmLastDay] = useState('')
  const [managerNotes, setManagerNotes] = useState('')
  const [confirming, setConfirming] = useState(false)

  const [toast, setToast] = useState('')
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    loadInquiries()
    loadResignations()
  }, [])

  const loadInquiries = async () => {
    setLoading(true)
    try {
      const res = await hrAPI.getInquiries()
      setInquiries(res.data?.results || res.data || [])
    } catch {}
    setLoading(false)
  }

  const loadResignations = async () => {
    setResignLoading(true)
    try {
      const res = await hrAPI.getResignationRequests()
      setResignations(res.data?.results || res.data || [])
    } catch {}
    setResignLoading(false)
  }

  const handleReply = async (id) => {
    if (!replyText.trim()) return
    setReplying(true)
    try {
      await hrAPI.replyInquiry(id, { reply: replyText })
      setReplyText('')
      setSelectedId(null)
      showToast('Reply sent')
      loadInquiries()
    } catch {
      showToast('Failed to reply')
    }
    setReplying(false)
  }

  const handleClose = async (id) => {
    try {
      await hrAPI.closeInquiry(id)
      showToast('Inquiry closed')
      loadInquiries()
    } catch {
      showToast('Failed to close')
    }
  }

  const handleConfirmResignation = async (id) => {
    setConfirming(true)
    try {
      await hrAPI.confirmResignation(id, {
        confirmed_last_day: confirmLastDay || undefined,
        manager_notes: managerNotes,
      })
      showToast('Resignation confirmed')
      setSelectedResignId(null)
      setConfirmLastDay('')
      setManagerNotes('')
      loadResignations()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to confirm')
    }
    setConfirming(false)
  }

  const filtered = filter === 'ALL' ? inquiries : inquiries.filter(i => i.status === filter)
  const pendingCount = inquiries.filter(i => i.status === 'PENDING').length
  const pendingResignCount = resignations.filter(r => r.status === 'PENDING').length
  const selected = inquiries.find(i => i.id === selectedId)
  const selectedResign = resignations.find(r => r.id === selectedResignId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employee Inquiries & Resignations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendingCount > 0 ? `${pendingCount} inquiry pending` : ''}{pendingCount > 0 && pendingResignCount > 0 ? ' · ' : ''}
            {pendingResignCount > 0 ? `${pendingResignCount} resignation pending` : ''}
            {pendingCount === 0 && pendingResignCount === 0 ? 'All caught up' : ''}
          </p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button onClick={() => setView('inquiries')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            view === 'inquiries' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}>
          Inquiries {pendingCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-100 text-yellow-700">{pendingCount}</span>}
        </button>
        <button onClick={() => setView('resignations')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            view === 'resignations' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
          }`}>
          Resignations {pendingResignCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">{pendingResignCount}</span>}
        </button>
      </div>

      {/* ═══════ Inquiries View ═══════ */}
      {view === 'inquiries' && (
        <>
          {/* Filter */}
          <div className="flex gap-2">
            {['ALL', 'PENDING', 'REPLIED', 'CLOSED'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {f === 'ALL' ? `All (${inquiries.length})` : `${f.charAt(0) + f.slice(1).toLowerCase()} (${inquiries.filter(i => i.status === f).length})`}
              </button>
            ))}
          </div>

          {/* Main: List + Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-2 space-y-2">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                  <p className="text-sm text-gray-500">No inquiries</p>
                </div>
              ) : (
                filtered.map(inq => (
                  <button key={inq.id} onClick={() => { setSelectedId(inq.id); setReplyText('') }}
                    className={`w-full text-left bg-white rounded-2xl border shadow-sm p-4 hover:bg-gray-50 transition ${
                      selectedId === inq.id ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-100'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[inq.status] || ''}`}>
                        {inq.status_display}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${CATEGORY_COLORS[inq.category] || ''}`}>
                        {inq.category_display}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{inq.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {inq.employee_name} · {new Date(inq.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="lg:col-span-3">
              {selected ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 sticky top-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[selected.status] || ''}`}>
                        {selected.status_display}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${CATEGORY_COLORS[selected.category] || ''}`}>
                        {selected.category_display}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-gray-900">{selected.subject}</h2>
                    <p className="text-xs text-gray-400">{selected.employee_name} · {new Date(selected.created_at).toLocaleString()}</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.message}</p>
                  </div>

                  {selected.reply && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                      <p className="text-xs text-green-600 mb-1 font-semibold">
                        Reply by {selected.replied_by_name || 'Manager'}
                        {selected.replied_at && ` · ${new Date(selected.replied_at).toLocaleString()}`}
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.reply}</p>
                    </div>
                  )}

                  {selected.status === 'PENDING' && (
                    <div className="space-y-2">
                      <textarea placeholder="Type your reply..." rows={3} value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                      <button onClick={() => handleReply(selected.id)}
                        disabled={replying || !replyText.trim()}
                        className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition">
                        {replying ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  )}

                  {selected.status === 'REPLIED' && (
                    <button onClick={() => handleClose(selected.id)}
                      className="w-full py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                      Close Inquiry
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                  <p className="text-sm text-gray-400">Select an inquiry to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════ Resignations View ═══════ */}
      {view === 'resignations' && (
        <>
          {resignLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" /></div>
          ) : resignations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <p className="text-sm text-gray-400">No resignation requests</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* List */}
              <div className="lg:col-span-2 space-y-2">
                {resignations.map(r => (
                  <button key={r.id}
                    onClick={() => {
                      setSelectedResignId(r.id)
                      setConfirmLastDay(r.requested_last_day)
                      setManagerNotes(r.manager_notes || '')
                    }}
                    className={`w-full text-left bg-white rounded-2xl border shadow-sm p-4 hover:bg-gray-50 transition ${
                      selectedResignId === r.id ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${RESIGN_STATUS_COLORS[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{r.employee_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Requested: {r.requested_last_day} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>

              {/* Detail */}
              <div className="lg:col-span-3">
                {selectedResign ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 sticky top-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${RESIGN_STATUS_COLORS[selectedResign.status] || ''}`}>
                          {selectedResign.status}
                        </span>
                        {selectedResign.work_type_display && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600">
                            {selectedResign.work_type_display}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-bold text-gray-900">{selectedResign.employee_name}</h2>
                      <p className="text-xs text-gray-400">Submitted: {new Date(selectedResign.created_at).toLocaleString()}</p>
                    </div>

                    {/* Reason */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1 font-medium">Reason</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedResign.reason}</p>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-amber-50 rounded-xl p-3">
                        <p className="text-[10px] text-amber-600 font-medium">Notice Period</p>
                        <p className="text-sm font-bold text-amber-800">{selectedResign.notice_period_weeks} week(s)</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3">
                        <p className="text-[10px] text-amber-600 font-medium">Earliest Last Day</p>
                        <p className="text-sm font-bold text-amber-800">{selectedResign.earliest_last_day}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-[10px] text-blue-600 font-medium">Requested Last Day</p>
                        <p className="text-sm font-bold text-blue-800">{selectedResign.requested_last_day}</p>
                      </div>
                      {selectedResign.confirmed_last_day && (
                        <div className="bg-green-50 rounded-xl p-3">
                          <p className="text-[10px] text-green-600 font-medium">Confirmed Last Day</p>
                          <p className="text-sm font-bold text-green-800">{selectedResign.confirmed_last_day}</p>
                        </div>
                      )}
                    </div>

                    {/* Manager notes (if confirmed) */}
                    {selectedResign.status === 'CONFIRMED' && selectedResign.manager_notes && (
                      <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                        <p className="text-xs text-green-600 mb-1 font-semibold">
                          Confirmed by {selectedResign.confirmed_by_name}
                          {selectedResign.confirmed_at && ` · ${new Date(selectedResign.confirmed_at).toLocaleString()}`}
                        </p>
                        <p className="text-sm text-gray-700">{selectedResign.manager_notes}</p>
                      </div>
                    )}

                    {/* Confirm form (only for PENDING) */}
                    {selectedResign.status === 'PENDING' && (
                      <div className="space-y-3 border-t border-gray-100 pt-4">
                        <h3 className="text-sm font-semibold text-gray-900">Confirm Resignation</h3>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Confirmed Last Day (can negotiate)
                          </label>
                          <input type="date" value={confirmLastDay}
                            onChange={e => setConfirmLastDay(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400" />
                          <p className="text-[10px] text-gray-400 mt-1">Employee requested: {selectedResign.requested_last_day}. You can adjust this date.</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Manager Notes (optional)</label>
                          <textarea value={managerNotes} onChange={e => setManagerNotes(e.target.value)}
                            rows={2} placeholder="Any notes for the employee..."
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
                        </div>
                        <button onClick={() => handleConfirmResignation(selectedResign.id)}
                          disabled={confirming}
                          className="w-full py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-40 transition">
                          {confirming ? 'Confirming...' : 'Confirm Resignation'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                    <p className="text-sm text-gray-400">Select a resignation to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

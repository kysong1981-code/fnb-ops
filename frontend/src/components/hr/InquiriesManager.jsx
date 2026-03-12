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
  LEAVE: 'bg-indigo-50 text-indigo-600',
  OTHER: 'bg-gray-50 text-gray-600',
}

export default function InquiriesManager() {
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [filter, setFilter] = useState('ALL') // ALL, PENDING, REPLIED, CLOSED
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    loadInquiries()
  }, [])

  const loadInquiries = async () => {
    setLoading(true)
    try {
      const res = await hrAPI.getInquiries()
      setInquiries(res.data?.results || res.data || [])
    } catch {}
    setLoading(false)
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

  const filtered = filter === 'ALL' ? inquiries : inquiries.filter(i => i.status === filter)
  const pendingCount = inquiries.filter(i => i.status === 'PENDING').length
  const selected = inquiries.find(i => i.id === selectedId)

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
          <h1 className="text-xl font-bold text-gray-900">Employee Inquiries</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendingCount > 0 ? `${pendingCount} pending` : 'All caught up'} · {inquiries.length} total
          </p>
        </div>
      </div>

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
        {/* List */}
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

        {/* Detail */}
        <div className="lg:col-span-3">
          {selected ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 sticky top-6">
              {/* Header */}
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

              {/* Message */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.message}</p>
              </div>

              {/* Existing reply */}
              {selected.reply && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <p className="text-xs text-green-600 mb-1 font-semibold">
                    Reply by {selected.replied_by_name || 'Manager'}
                    {selected.replied_at && ` · ${new Date(selected.replied_at).toLocaleString()}`}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.reply}</p>
                </div>
              )}

              {/* Reply Form (only for PENDING) */}
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

              {/* Close button (for REPLIED) */}
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

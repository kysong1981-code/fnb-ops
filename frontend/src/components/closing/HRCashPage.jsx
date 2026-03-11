import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { closingAPI, hrCashAPI } from '../../services/api'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'
import { CameraIcon, TrashIcon } from '../icons'

const API_BASE = 'http://localhost:8000'

export default function HRCashPage() {
  const { user } = useAuth()

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  // Form
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  const showMsg = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // Load recent HR cash entries
  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    setLoading(true)
    try {
      const res = await hrCashAPI.list()
      const data = res.data.results || res.data || []
      // Sort by most recent
      data.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      setEntries(data.slice(0, 20))
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  // Handle photo selection
  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      const reader = new FileReader()
      reader.onload = (ev) => setPhotoPreview(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  // Save HR cash entry
  const handleSave = async (e) => {
    e.preventDefault()
    if (!amount || !recipient) {
      setError('Recipient and amount are required')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Find or create closing for the date
      let closingId = null
      const closingRes = await closingAPI.getByDate(date)
      const closings = closingRes.data.results || closingRes.data || []

      if (closings.length > 0) {
        closingId = closings[0].id
      } else {
        // Create a closing for this date
        const newClosing = await closingAPI.create({
          organization: user?.organization,
          closing_date: date,
          pos_card: 0,
          pos_cash: 0,
          actual_card: 0,
          actual_cash: 0,
        })
        closingId = newClosing.data.id
      }

      // Create HR cash entry
      const fd = new FormData()
      fd.append('daily_closing', closingId)
      fd.append('amount', amount)
      fd.append('recipient_name', recipient)
      if (notes) fd.append('notes', notes)
      if (photo) fd.append('photo', photo)

      await hrCashAPI.create(fd)

      // Reset form
      setRecipient('')
      setAmount('')
      setNotes('')
      setPhoto(null)
      setPhotoPreview(null)
      showMsg('HR Cash saved')
      loadEntries()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save HR cash')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await hrCashAPI.delete(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch {
      setError('Failed to delete')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">HR Cash</h1>
        <p className="text-sm text-gray-400 mt-0.5">Record cash handed to head office</p>
      </div>

      {/* Messages */}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

      {/* New Entry Form */}
      <Card className="p-5">
        <SectionLabel>New Entry</SectionLabel>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Recipient *</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Who received the cash"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount *</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Weekly petty cash handover"
              className={inputCls}
            />
          </div>

          {/* Photo upload */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Photo (optional)</label>
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                  className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-lg hover:bg-white transition"
                >
                  <TrashIcon size={16} className="text-red-500" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition">
                <CameraIcon size={24} className="text-gray-300 mb-2" />
                <span className="text-xs text-gray-400">Tap to take photo or upload</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !recipient || !amount}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'Save HR Cash'}
          </button>
        </form>
      </Card>

      {/* Recent Entries */}
      <Card className="p-5">
        <SectionLabel>Recent Entries</SectionLabel>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No entries yet</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                {/* Photo thumbnail */}
                {entry.photo ? (
                  <img
                    src={entry.photo.startsWith('http') ? entry.photo : `${API_BASE}${entry.photo}`}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <CameraIcon size={16} className="text-gray-400" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {entry.recipient_name || 'HR Cash'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {formatDate(entry.created_at)}
                    </span>
                    {entry.notes && (
                      <span className="text-xs text-gray-300 truncate">{entry.notes}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-2">
                  <span className="text-sm font-semibold text-gray-900">{fmt(entry.amount)}</span>
                  <button onClick={() => handleDelete(entry.id)} className="text-gray-300 hover:text-red-500 transition">
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

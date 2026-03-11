import { useState, useEffect } from 'react'
import { hrAPI } from '../../services/api'
import Card from '../ui/Card'
import PageHeader from '../ui/PageHeader'
import { EditIcon, TrashIcon, PlusIcon, ChevronLeftIcon } from '../icons'
import { useNavigate } from 'react-router-dom'

/* ── colour map ── */
const COLOR_MAP = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400',    ring: 'ring-blue-400' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', ring: 'ring-emerald-400' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',   ring: 'ring-amber-400' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-400',    ring: 'ring-rose-400' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400',  ring: 'ring-purple-400' },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-400',    ring: 'ring-cyan-400' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-400',  ring: 'ring-indigo-400' },
  pink:    { bg: 'bg-pink-50',    text: 'text-pink-700',    dot: 'bg-pink-400',    ring: 'ring-pink-400' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-400',  ring: 'ring-orange-400' },
  red:     { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400',     ring: 'ring-red-400' },
}

const colorOptions = Object.keys(COLOR_MAP)
const fmt = (t) => (t ? t.slice(0, 5) : '--:--')

const emptyForm = { name: '', start_time: '09:00', end_time: '17:00', break_minutes: 30, color: 'blue' }

export default function ShiftTemplateSettings() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [editing, setEditing] = useState(null) // template id or null (new)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await hrAPI.getShiftTemplates()
      setTemplates(Array.isArray(res.data) ? res.data : res.data?.results || [])
    } catch {
      setError('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTemplates() }, [])

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await hrAPI.updateShiftTemplate(editing, form)
      } else {
        await hrAPI.createShiftTemplate(form)
      }
      setShowForm(false)
      setEditing(null)
      setForm({ ...emptyForm })
      await fetchTemplates()
    } catch (err) {
      const detail = err.response?.data
      setError(typeof detail === 'object' ? JSON.stringify(detail) : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await hrAPI.deleteShiftTemplate(id)
      await fetchTemplates()
    } catch {
      setError('Failed to delete template')
    }
  }

  const startEdit = (tpl) => {
    setEditing(tpl.id)
    setForm({
      name: tpl.name,
      start_time: fmt(tpl.start_time),
      end_time: fmt(tpl.end_time),
      break_minutes: tpl.break_minutes ?? 30,
      color: tpl.color,
    })
    setShowForm(true)
  }

  const startNew = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ ...emptyForm })
  }

  return (
    <div className="px-4 py-6 space-y-5 max-w-2xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/manager/roster')}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div className="flex-1">
          <PageHeader title="Shift Templates" subtitle="Create and manage shift types for your roster" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Template list */}
      <Card className="divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No shift templates yet</p>
            <p className="text-xs mt-1">Create templates to quickly assign shifts</p>
          </div>
        ) : (
          templates.map((tpl) => {
            const c = COLOR_MAP[tpl.color] || COLOR_MAP.blue
            return (
              <div key={tpl.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition">
                {/* Color dot */}
                <div className={`w-4 h-4 rounded-full ${c.dot} flex-shrink-0`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{tpl.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text} font-medium`}>
                      {fmt(tpl.start_time)} – {fmt(tpl.end_time)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Break: {tpl.break_minutes ?? 30} min
                  </p>
                </div>

                {/* Actions */}
                <button
                  onClick={() => startEdit(tpl)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <EditIcon size={16} />
                </button>
                <button
                  onClick={() => handleDelete(tpl.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            )
          })
        )}
      </Card>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={startNew}
          className="flex items-center gap-2 w-full px-5 py-4 bg-white border border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition"
        >
          <PlusIcon size={18} />
          <span className="text-sm font-medium">Add New Template</span>
        </button>
      )}

      {/* ══ Add/Edit Form ══ */}
      {showForm && (
        <Card className="p-5 space-y-4">
          <h3 className="font-bold text-gray-900 text-sm">
            {editing ? 'Edit Template' : 'New Template'}
          </h3>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Morning, Hot Meal, Sushi"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              autoFocus
            />
          </div>

          {/* Times + Break */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Break (min)</label>
              <input
                type="number" min="0" max="120"
                value={form.break_minutes}
                onChange={(e) => setForm((f) => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Colour</label>
            <div className="flex gap-2.5 flex-wrap">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full ${COLOR_MAP[c].dot} transition ring-offset-2 ${
                    form.color === c ? 'ring-2 ring-gray-900 scale-110' : 'hover:ring-2 hover:ring-gray-300 hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={cancelForm} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:bg-gray-300 text-sm font-medium"
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Create Template'}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}

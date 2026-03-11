import { useState, useEffect, useCallback, useRef } from 'react'
import { hrAPI } from '../../services/api'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import {
  ChevronLeftIcon, ChevronRightIcon, XIcon,
  CopyIcon, EditIcon, ClockIcon, CoffeeIcon,
  CheckCircleIcon,
} from '../icons'
import { useNavigate } from 'react-router-dom'

/* ── colour map ── */
const COLOR_MAP = {
  blue:    { bg: 'bg-blue-50',    border: 'border-l-blue-400',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  emerald: { bg: 'bg-emerald-50', border: 'border-l-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  amber:   { bg: 'bg-amber-50',   border: 'border-l-amber-400',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  rose:    { bg: 'bg-rose-50',    border: 'border-l-rose-400',    text: 'text-rose-700',    dot: 'bg-rose-400' },
  purple:  { bg: 'bg-purple-50',  border: 'border-l-purple-400',  text: 'text-purple-700',  dot: 'bg-purple-400' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-l-cyan-400',    text: 'text-cyan-700',    dot: 'bg-cyan-400' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-l-indigo-400',  text: 'text-indigo-700',  dot: 'bg-indigo-400' },
  pink:    { bg: 'bg-pink-50',    border: 'border-l-pink-400',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  orange:  { bg: 'bg-orange-50',  border: 'border-l-orange-400',  text: 'text-orange-700',  dot: 'bg-orange-400' },
  red:     { bg: 'bg-red-50',     border: 'border-l-red-400',     text: 'text-red-700',     dot: 'bg-red-400' },
}
const fallbackColor = COLOR_MAP.blue

const getShiftStyleFromTime = (startTime) => {
  const h = parseInt(startTime?.split(':')[0] || '0')
  if (h >= 5 && h < 12) return { ...COLOR_MAP.blue, label: 'Morning' }
  if (h >= 12 && h < 17) return { ...COLOR_MAP.emerald, label: 'Afternoon' }
  if (h >= 17 && h < 22) return { ...COLOR_MAP.amber, label: 'Closing' }
  return { ...COLOR_MAP.purple, label: 'Night' }
}

const getShiftStyle = (roster) => {
  if (roster.shift_color && COLOR_MAP[roster.shift_color])
    return { ...COLOR_MAP[roster.shift_color], label: roster.shift_name || '' }
  if (roster.shift_name) return { ...fallbackColor, label: roster.shift_name }
  return getShiftStyleFromTime(roster.shift_start)
}

const fmt = (t) => (t ? t.slice(0, 5) : '--:--')

export default function RosterManagement() {
  const navigate = useNavigate()
  const [weekOffset, setWeekOffset] = useState(0)
  const [rosters, setRosters] = useState([])
  const [team, setTeam] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [weekRange, setWeekRange] = useState({ start: '', end: '' })

  // Modal
  const [modal, setModal] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [shiftStart, setShiftStart] = useState('09:00')
  const [shiftEnd, setShiftEnd] = useState('17:00')
  const [shiftName, setShiftName] = useState('')
  const [shiftColor, setShiftColor] = useState('blue')
  const [breakMinutes, setBreakMinutes] = useState(30)

  // Break settings popover
  const [showBreakSettings, setShowBreakSettings] = useState(false)
  const [defaultBreak, setDefaultBreak] = useState(30)

  // Copy mode (single)
  const [clipboard, setClipboard] = useState(null)
  const [copyMode, setCopyMode] = useState(false)

  // Drag
  const dragRef = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  // Copy last week
  const [copying, setCopying] = useState(false)

  // ── Multi-select ──
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkClipboard, setBulkClipboard] = useState([])
  const [bulkPasteMode, setBulkPasteMode] = useState(false)
  const [pasteQueue, setPasteQueue] = useState([])
  const [bulkMoveMode, setBulkMoveMode] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  /* ── helpers ── */
  const toLocalDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  const getWeekDate = useCallback(() => {
    const now = new Date()
    const day = now.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset + weekOffset * 7)
    return toLocalDate(monday)
  }, [weekOffset])

  const getWeekDays = useCallback(() => {
    const mondayStr = getWeekDate()
    const [y, m, d] = mondayStr.split('-').map(Number)
    const monday = new Date(y, m - 1, d)
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      return toLocalDate(day)
    })
  }, [getWeekDate])

  /* ── fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const date = getWeekDate()
      const [rosterRes, teamRes, tplRes] = await Promise.all([
        hrAPI.getRosterWeekly(date),
        hrAPI.getTeam(),
        hrAPI.getShiftTemplates(),
      ])
      setRosters(rosterRes.data.rosters || [])
      setTeam(Array.isArray(teamRes.data) ? teamRes.data : teamRes.data?.results || [])
      setTemplates(Array.isArray(tplRes.data) ? tplRes.data : tplRes.data?.results || [])
      setWeekRange({ start: rosterRes.data.week_start, end: rosterRes.data.week_end })
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [getWeekDate])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const saved = localStorage.getItem('defaultBreakMinutes')
    if (saved) setDefaultBreak(parseInt(saved) || 30)
  }, [])

  /* ── actions ── */
  const handleSaveShift = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        user: modal.employeeId,
        date: modal.date,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        shift_name: shiftName || null,
        shift_color: shiftColor || null,
        shift_template: selectedTemplate?.id || null,
        break_minutes: breakMinutes,
      }
      if (modal.mode === 'edit' && modal.rosterId) {
        await hrAPI.updateRoster(modal.rosterId, payload)
      } else {
        const existing = rosters.find((r) => r.user === modal.employeeId && r.date === modal.date)
        if (existing) {
          await hrAPI.updateRoster(existing.id, payload)
        } else {
          await hrAPI.createRoster(payload)
        }
      }
      setModal(null)
      await fetchData()
    } catch (err) {
      const data = err.response?.data
      if (data?.non_field_errors?.some((e) => e.includes('unique'))) {
        setError('This employee already has a shift on this day. Try editing the existing shift.')
      } else {
        setError(typeof data === 'object' ? JSON.stringify(data) : 'Failed to save shift')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRoster = async (id) => {
    try {
      await hrAPI.deleteRoster(id)
      await fetchData()
    } catch {
      setError('Failed to delete shift')
    }
  }

  const handlePublish = async () => {
    setSaving(true)
    try {
      const unconfirmed = rosters.filter((r) => !r.is_confirmed)
      await Promise.all(unconfirmed.map((r) => hrAPI.updateRoster(r.id, { is_confirmed: true })))
      await fetchData()
    } catch {
      setError('Failed to publish')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyLastWeek = async () => {
    setCopying(true)
    setError('')
    try {
      const currentMonday = getWeekDate()
      const [y, m, d] = currentMonday.split('-').map(Number)
      const prev = new Date(y, m - 1, d - 7)
      await hrAPI.copyWeekRoster(toLocalDate(prev), currentMonday)
      await fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to copy last week')
    } finally {
      setCopying(false)
    }
  }

  /* ── modal openers ── */
  const openAddModal = (emp, date) => {
    setModal({ mode: 'add', employeeId: emp.id, employeeName: emp.name, date })
    setSelectedTemplate(null)
    setShiftStart('09:00')
    setShiftEnd('17:00')
    setShiftName('')
    setShiftColor('blue')
    setBreakMinutes(defaultBreak)
  }

  const openEditModal = (emp, roster) => {
    setModal({ mode: 'edit', employeeId: emp.id, employeeName: emp.name, date: roster.date, rosterId: roster.id })
    setShiftStart(fmt(roster.shift_start))
    setShiftEnd(fmt(roster.shift_end))
    setShiftName(roster.shift_name || '')
    setShiftColor(roster.shift_color || 'blue')
    setBreakMinutes(roster.break_minutes ?? 30)
    const match = templates.find((t) => t.id === roster.shift_template)
    setSelectedTemplate(match || null)
  }

  const pickTemplate = (tpl) => {
    setSelectedTemplate(tpl)
    setShiftStart(tpl.start_time.slice(0, 5))
    setShiftEnd(tpl.end_time.slice(0, 5))
    setShiftName(tpl.name)
    setShiftColor(tpl.color)
    setBreakMinutes(tpl.break_minutes ?? defaultBreak)
  }

  /* ── single copy shift ── */
  const handleCopyShift = (roster) => {
    setClipboard({
      shift_start: roster.shift_start,
      shift_end: roster.shift_end,
      shift_name: roster.shift_name,
      shift_color: roster.shift_color,
      shift_template: roster.shift_template,
      break_minutes: roster.break_minutes ?? 30,
    })
    setCopyMode(true)
  }

  const handlePasteShift = async (empId, date) => {
    if (!clipboard) return
    setSaving(true)
    setError('')
    try {
      await hrAPI.createRoster({
        user: empId,
        date,
        shift_start: clipboard.shift_start,
        shift_end: clipboard.shift_end,
        shift_name: clipboard.shift_name,
        shift_color: clipboard.shift_color,
        shift_template: clipboard.shift_template,
        break_minutes: clipboard.break_minutes,
      })
    } catch (err) {
      const data = err.response?.data
      setError(typeof data === 'object' ? JSON.stringify(data) : 'Failed to paste shift')
    }
    await fetchData()
    setSaving(false)
  }

  const exitCopyMode = () => { setCopyMode(false); setClipboard(null) }

  /* ── drag & drop ── */
  const handleDragStart = (e, roster) => {
    dragRef.current = roster
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', roster.id)
  }

  const handleDragOver = (e, empId, date) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const draggedRoster = dragRef.current
    if (draggedRoster && draggedRoster.user === empId && draggedRoster.date === date) return
    setDragOver(`${empId}_${date}`)
  }

  const handleDragLeave = () => setDragOver(null)

  const handleDrop = async (e, empId, date) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    const roster = dragRef.current
    dragRef.current = null
    if (!roster) return
    if (roster.user === empId && roster.date === date) return

    try {
      await hrAPI.updateRoster(roster.id, { user: empId, date })
    } catch (err) {
      const data = err.response?.data
      setError(typeof data === 'object' ? JSON.stringify(data) : 'Failed to move shift')
    }
    await fetchData()
  }

  const handleDragEnd = () => { dragRef.current = null; setDragOver(null) }

  /* ── break settings ── */
  const saveDefaultBreak = (val) => {
    const v = parseInt(val) || 0
    setDefaultBreak(v)
    localStorage.setItem('defaultBreakMinutes', String(v))
  }

  /* ═══════════════════════════════════════════════
     ═══  MULTI-SELECT  ═══════════════════════════
     ═══════════════════════════════════════════════ */

  const toggleSelectMode = () => {
    if (selectMode) {
      // Exit select mode — clear everything
      setSelectMode(false)
      setSelected(new Set())
      setBulkClipboard([])
      setBulkPasteMode(false)
      setPasteQueue([])
      setBulkMoveMode(false)
      setConfirmDelete(false)
    } else {
      // Enter select mode — disable single copy mode
      setSelectMode(true)
      setCopyMode(false)
      setClipboard(null)
    }
  }

  const toggleSelect = (rosterId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rosterId)) next.delete(rosterId)
      else next.add(rosterId)
      return next
    })
  }

  const selectAllForEmployee = (empId) => {
    const empRosters = rosters.filter((r) => r.user === empId)
    const allSelected = empRosters.every((r) => selected.has(r.id))
    setSelected((prev) => {
      const next = new Set(prev)
      empRosters.forEach((r) => {
        if (allSelected) next.delete(r.id)
        else next.add(r.id)
      })
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === rosters.length && rosters.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rosters.map((r) => r.id)))
    }
  }

  const clearSelection = () => {
    setSelected(new Set())
    setBulkPasteMode(false)
    setPasteQueue([])
    setBulkMoveMode(false)
    setConfirmDelete(false)
  }

  /* ── Bulk Delete ── */
  const handleBulkDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      const ids = [...selected]
      await hrAPI.bulkDeleteRosters(ids)
      setSelected(new Set())
      setConfirmDelete(false)
      await fetchData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to bulk delete')
    } finally {
      setSaving(false)
    }
  }

  /* ── Bulk Copy ── */
  const handleBulkCopy = () => {
    const selectedRosters = rosters.filter((r) => selected.has(r.id))
    const clips = selectedRosters.map((r) => ({
      shift_start: r.shift_start,
      shift_end: r.shift_end,
      shift_name: r.shift_name,
      shift_color: r.shift_color,
      shift_template: r.shift_template,
      break_minutes: r.break_minutes ?? 30,
      _srcUser: r.user,
      _srcDate: r.date,
    }))
    setBulkClipboard(clips)
    setPasteQueue([...clips])
    setBulkPasteMode(true)
    setBulkMoveMode(false)
  }

  /* ── Bulk Move = Copy + Delete originals ── */
  const handleBulkMove = () => {
    const selectedRosters = rosters.filter((r) => selected.has(r.id))
    const clips = selectedRosters.map((r) => ({
      id: r.id,
      shift_start: r.shift_start,
      shift_end: r.shift_end,
      shift_name: r.shift_name,
      shift_color: r.shift_color,
      shift_template: r.shift_template,
      break_minutes: r.break_minutes ?? 30,
      _srcUser: r.user,
      _srcDate: r.date,
    }))
    setBulkClipboard(clips)
    setPasteQueue([...clips])
    setBulkPasteMode(true)
    setBulkMoveMode(true)
  }

  /* ── Bulk Paste (one at a time) ── */
  const handleBulkPaste = async (empId, date) => {
    if (pasteQueue.length === 0) return
    setSaving(true)
    setError('')
    try {
      const item = pasteQueue[0]
      // Create roster at target
      await hrAPI.createRoster({
        user: empId,
        date,
        shift_start: item.shift_start,
        shift_end: item.shift_end,
        shift_name: item.shift_name,
        shift_color: item.shift_color,
        shift_template: item.shift_template,
        break_minutes: item.break_minutes,
      })
      // If move mode, delete original
      if (bulkMoveMode && item.id) {
        try { await hrAPI.deleteRoster(item.id) } catch { /* already moved or deleted */ }
      }
      const remaining = pasteQueue.slice(1)
      setPasteQueue(remaining)
      if (remaining.length === 0) {
        exitBulkPasteMode()
      }
      await fetchData()
    } catch (err) {
      const data = err.response?.data
      setError(typeof data === 'object' ? JSON.stringify(data) : 'Failed to paste shift')
    } finally {
      setSaving(false)
    }
  }

  const exitBulkPasteMode = () => {
    setBulkPasteMode(false)
    setPasteQueue([])
    setBulkClipboard([])
    setBulkMoveMode(false)
    setSelected(new Set())
  }

  /* ── derived ── */
  const weekDays = getWeekDays()
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const todayStr = toLocalDate(new Date())
  const isToday = (d) => d === todayStr

  const getRosterForEmployee = (empId, date) => rosters.find((r) => r.user === empId && r.date === date)
  const getWeeklyHours = (empId) => rosters.filter((r) => r.user === empId).reduce((s, r) => s + (r.hours || 0), 0)
  const getDayTotalHours = (date) => rosters.filter((r) => r.date === date).reduce((s, r) => s + (r.hours || 0), 0)
  const getDayNum = (d) => new Date(d + 'T00:00:00').getDate()
  const unpublishedCount = rosters.filter((r) => !r.is_confirmed).length

  const avatarColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
    'bg-purple-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
  ]
  const colorOptions = Object.keys(COLOR_MAP)

  // Is the current cell interaction mode
  const isInBulkMode = selectMode || bulkPasteMode

  return (
    <div className="px-4 py-6 space-y-5">
      {/* ══ Header ══ */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Shift</h1>
        <div className="flex items-center gap-2">
          {/* ── Select mode toggle ── */}
          <button
            onClick={toggleSelectMode}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-xl transition ${
              selectMode
                ? 'text-blue-600 bg-blue-50 border-blue-200'
                : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <CheckCircleIcon size={14} />
            {selectMode ? 'Done' : 'Select'}
          </button>
          {/* ── Templates button ── */}
          <button
            onClick={() => navigate('/manager/roster/settings')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <ClockIcon size={14} />
            Templates
          </button>
          {/* ── Break button ── */}
          <div className="relative">
            <button
              onClick={() => setShowBreakSettings((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-xl transition ${
                showBreakSettings
                  ? 'text-blue-600 bg-blue-50 border-blue-200'
                  : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <CoffeeIcon size={14} />
              Break
            </button>
            {showBreakSettings && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-lg z-30 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Default Break</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min="0" max="120" value={defaultBreak}
                    onChange={(e) => saveDefaultBreak(e.target.value)}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-sm text-gray-500">minutes</span>
                </div>
                <p className="text-[11px] text-gray-400">Applied to new shifts by default</p>
              </div>
            )}
          </div>
          {unpublishedCount > 0 && (
            <Badge variant="warning">{unpublishedCount} unpublished</Badge>
          )}
        </div>
      </div>

      {/* ══ Single copy mode banner ══ */}
      {copyMode && clipboard && !selectMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <p className="text-blue-700 text-sm font-medium">
            Copied: <span className="font-bold">{clipboard.shift_name || fmt(clipboard.shift_start) + ' – ' + fmt(clipboard.shift_end)}</span> — click any cell to paste
          </p>
          <button onClick={exitCopyMode} className="text-blue-400 hover:text-blue-700 text-sm font-medium">Cancel</button>
        </div>
      )}

      {/* ══ Bulk paste mode banner ══ */}
      {bulkPasteMode && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <p className="text-emerald-700 text-sm font-medium">
            {bulkMoveMode ? '🔀 Move' : '📋 Paste'} — <span className="font-bold">{pasteQueue.length}</span> shift{pasteQueue.length !== 1 ? 's' : ''} remaining — click target cells one by one
          </p>
          <button onClick={exitBulkPasteMode} className="text-emerald-400 hover:text-emerald-700 text-sm font-medium">Cancel</button>
        </div>
      )}

      {/* ══ Week Navigation ══ */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setWeekOffset(0)}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
            weekOffset === 0 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >Today</button>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekOffset((p) => p - 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeftIcon size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
            {weekRange.start ? weekRange.start.slice(5).replace('-', '/') : ''}
          </span>
          <button onClick={() => setWeekOffset((p) => p + 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition">
            <ChevronRightIcon size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleCopyLastWeek} disabled={copying}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
          >
            <CopyIcon size={14} />
            {copying ? 'Copying...' : 'Copy Last Week'}
          </button>
          <button
            onClick={handlePublish} disabled={saving || unpublishedCount === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >{saving ? 'Publishing...' : 'Publish'}</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center justify-between">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><XIcon size={14} /></button>
        </div>
      )}

      {loading ? (
        <Card className="p-12 text-center"><p className="text-gray-400">Loading roster...</p></Card>
      ) : (
        /* ══ Grid ══ */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 w-[180px] sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      {selectMode && (
                        <button
                          onClick={selectAll}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition text-xs ${
                            selected.size === rosters.length && rosters.length > 0
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          {selected.size === rosters.length && rosters.length > 0 ? '✓' : ''}
                        </button>
                      )}
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{team.length} Staff</span>
                    </div>
                  </th>
                  {weekDays.map((date, i) => {
                    const today = isToday(date)
                    const totalHrs = getDayTotalHours(date)
                    return (
                      <th key={date} className={`text-center py-3 px-2 min-w-[120px] ${today ? 'bg-blue-50/50' : ''}`}>
                        <div className={`text-2xl font-bold ${today ? 'text-blue-600' : 'text-gray-900'}`}>{getDayNum(date)}</div>
                        <div className={`text-xs font-medium ${today ? 'text-blue-600' : 'text-gray-400'}`}>{dayLabels[i]}</div>
                        {totalHrs > 0 && <div className="text-[10px] text-gray-400 mt-0.5">{totalHrs.toFixed(1)}h</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {team.map((emp) => {
                  const weeklyHrs = getWeeklyHours(emp.id)
                  const initial = (emp.name || '?')[0].toUpperCase()
                  const avatarColor = avatarColors[emp.id % avatarColors.length]
                  const empRosters = rosters.filter((r) => r.user === emp.id)
                  const allEmpSelected = empRosters.length > 0 && empRosters.every((r) => selected.has(r.id))

                  return (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                      <td className="py-3 px-4 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-3">
                          {selectMode && (
                            <button
                              onClick={() => selectAllForEmployee(emp.id)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition text-xs flex-shrink-0 ${
                                allEmpSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-gray-300 hover:border-blue-400'
                              }`}
                            >
                              {allEmpSelected ? '✓' : ''}
                            </button>
                          )}
                          <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{initial}</div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{emp.name}</p>
                            <p className="text-xs text-gray-400">{weeklyHrs > 0 ? `${weeklyHrs.toFixed(1)}h` : '0 Hrs'}</p>
                          </div>
                        </div>
                      </td>

                      {weekDays.map((date) => {
                        const roster = getRosterForEmployee(emp.id, date)
                        const today = isToday(date)
                        const cellKey = `${emp.id}_${date}`
                        const isDragTarget = dragOver === cellKey
                        const isSelected = roster && selected.has(roster.id)

                        return (
                          <td key={date} className={`py-2 px-1.5 align-top ${today ? 'bg-blue-50/30' : ''}`}>
                            {roster ? (() => {
                              const s = getShiftStyle(roster)
                              const draggable = !roster.is_confirmed && !selectMode && !bulkPasteMode
                              return (
                                <div
                                  draggable={draggable}
                                  onDragStart={draggable ? (e) => handleDragStart(e, roster) : undefined}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={!isInBulkMode ? (e) => handleDragOver(e, emp.id, date) : undefined}
                                  onDragLeave={!isInBulkMode ? handleDragLeave : undefined}
                                  onDrop={!isInBulkMode ? (e) => handleDrop(e, emp.id, date) : undefined}
                                  onClick={
                                    selectMode
                                      ? () => toggleSelect(roster.id)
                                      : bulkPasteMode
                                        ? () => handleBulkPaste(emp.id, date)
                                        : copyMode
                                          ? () => handlePasteShift(emp.id, date)
                                          : undefined
                                  }
                                  className={`${s.bg} border-l-[3px] ${s.border} rounded-lg p-2 group relative transition ${
                                    draggable ? 'cursor-grab active:cursor-grabbing' : ''
                                  } ${isDragTarget ? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${
                                    copyMode && !selectMode ? 'cursor-pointer hover:ring-2 hover:ring-emerald-400 hover:ring-offset-1' : ''
                                  } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''} ${
                                    selectMode ? 'cursor-pointer' : ''
                                  } ${bulkPasteMode ? 'cursor-pointer hover:ring-2 hover:ring-emerald-400 hover:ring-offset-1' : ''}`}
                                >
                                  {/* Selection checkbox overlay */}
                                  {selectMode && (
                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded border-2 flex items-center justify-center text-[9px] z-10 ${
                                      isSelected
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white/80 border-gray-400'
                                    }`}>
                                      {isSelected ? '✓' : ''}
                                    </div>
                                  )}

                                  <div className={`text-xs font-semibold ${s.text} truncate`}>{s.label}</div>
                                  <div className="text-[11px] text-gray-500 mt-0.5">
                                    {fmt(roster.shift_start)} – {fmt(roster.shift_end)}
                                  </div>
                                  {roster.break_minutes > 0 && (
                                    <div className="text-[10px] text-gray-400 mt-0.5">Break {roster.break_minutes}m</div>
                                  )}
                                  {!roster.is_confirmed && (
                                    <div className="text-[10px] text-gray-400 mt-0.5">draft</div>
                                  )}
                                  {/* Hover actions — hidden in select/copy/paste mode */}
                                  {!copyMode && !selectMode && !bulkPasteMode && (
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition flex gap-0.5">
                                      <button onClick={(e) => { e.stopPropagation(); openEditModal(emp, roster) }} className="w-5 h-5 flex items-center justify-center rounded-full bg-white/90 text-gray-400 hover:text-blue-600 shadow-sm" title="Edit">
                                        <EditIcon size={10} />
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); handleCopyShift(roster) }} className="w-5 h-5 flex items-center justify-center rounded-full bg-white/90 text-gray-400 hover:text-emerald-600 shadow-sm" title="Copy">
                                        <CopyIcon size={10} />
                                      </button>
                                      {!roster.is_confirmed && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRoster(roster.id) }} className="w-5 h-5 flex items-center justify-center rounded-full bg-white/90 text-gray-400 hover:text-red-500 shadow-sm" title="Delete">
                                          <XIcon size={10} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })() : (
                              <button
                                onClick={
                                  bulkPasteMode
                                    ? () => handleBulkPaste(emp.id, date)
                                    : copyMode && !selectMode
                                      ? () => handlePasteShift(emp.id, date)
                                      : !selectMode
                                        ? () => openAddModal(emp, date)
                                        : undefined
                                }
                                onDragOver={!isInBulkMode ? (e) => handleDragOver(e, emp.id, date) : undefined}
                                onDragLeave={!isInBulkMode ? handleDragLeave : undefined}
                                onDrop={!isInBulkMode ? (e) => handleDrop(e, emp.id, date) : undefined}
                                className={`w-full h-[76px] border border-dashed rounded-lg transition flex items-center justify-center ${
                                  isDragTarget ? 'border-blue-400 bg-blue-50'
                                    : bulkPasteMode ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer'
                                    : copyMode && !selectMode ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
                                    : selectMode ? 'border-gray-200 cursor-default'
                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                                }`}
                              >
                                <span className={`text-lg leading-none ${
                                  isDragTarget ? 'text-blue-400'
                                    : (bulkPasteMode || (copyMode && !selectMode)) ? 'text-emerald-400'
                                    : selectMode ? 'text-gray-200'
                                    : 'text-gray-300'
                                }`}>
                                  {(bulkPasteMode || (copyMode && !selectMode)) ? '⊕' : selectMode ? '' : '+'}
                                </span>
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ══ Floating Action Bar (multi-select) ══ */}
      {selectMode && selected.size > 0 && !bulkPasteMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">
              <span className="text-blue-400 font-bold">{selected.size}</span> selected
            </span>
            <div className="w-px h-6 bg-gray-700" />
            <button
              onClick={handleBulkCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition"
            >
              <CopyIcon size={13} />
              Copy
            </button>
            <button
              onClick={handleBulkMove}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition"
            >
              🔀 Move
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition ${
                confirmDelete
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <XIcon size={13} />
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </button>
            <div className="w-px h-6 bg-gray-700" />
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Close break popover when clicking elsewhere */}
      {showBreakSettings && (
        <div className="fixed inset-0 z-20" onClick={() => setShowBreakSettings(false)} />
      )}

      {/* ══ Add / Edit Modal ══ */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{modal.mode === 'edit' ? 'Edit Shift' : 'Add Shift'}</h3>
              <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"><XIcon size={16} /></button>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{modal.employeeName}</p>
              <p className="text-xs text-gray-500">{modal.date}</p>
            </div>

            {/* Template picker */}
            {templates.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Template</label>
                <div className="flex gap-2 flex-wrap">
                  {templates.map((tpl) => {
                    const c = COLOR_MAP[tpl.color] || fallbackColor
                    const active = selectedTemplate?.id === tpl.id
                    return (
                      <button key={tpl.id} onClick={() => pickTemplate(tpl)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                          active ? `${c.bg} ${c.text} border-current` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                        {tpl.name}
                      </button>
                    )
                  })}
                  {selectedTemplate && (
                    <button onClick={() => { setSelectedTemplate(null); setShiftName(''); setShiftColor('blue'); setShiftStart('09:00'); setShiftEnd('17:00'); setBreakMinutes(defaultBreak) }}
                      className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">Clear</button>
                  )}
                </div>
              </div>
            )}

            {/* Times + break */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
                <input type="time" value={shiftStart}
                  onChange={(e) => { setShiftStart(e.target.value); setSelectedTemplate(null) }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
                <input type="time" value={shiftEnd}
                  onChange={(e) => { setShiftEnd(e.target.value); setSelectedTemplate(null) }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Break</label>
                <div className="relative">
                  <input type="number" min="0" max="120" value={breakMinutes}
                    onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">m</span>
                </div>
              </div>
            </div>

            {/* Custom name + colour */}
            {!selectedTemplate && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Shift Name (optional)</label>
                  <input type="text" value={shiftName} onChange={(e) => setShiftName(e.target.value)}
                    placeholder="e.g. Hot Meal, Sushi"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Colour</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {colorOptions.map((c) => (
                      <button key={c} onClick={() => setShiftColor(c)}
                        className={`w-6 h-6 rounded-full ${COLOR_MAP[c].dot} transition ring-offset-1 ${
                          shiftColor === c ? 'ring-2 ring-gray-800' : 'hover:ring-2 hover:ring-gray-300'
                        }`} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              {modal.mode === 'edit' && (
                <button onClick={() => { handleDeleteRoster(modal.rosterId); setModal(null) }}
                  className="mr-auto px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition text-sm">Delete</button>
              )}
              <button onClick={() => setModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition text-sm">Cancel</button>
              <button onClick={handleSaveShift} disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:bg-gray-300 text-sm font-medium">
                {saving ? 'Saving...' : modal.mode === 'edit' ? 'Update' : 'Add Shift'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

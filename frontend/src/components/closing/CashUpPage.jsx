import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { closingAPI, hrCashAPI, cashExpenseAPI } from '../../services/api'
import { getTodayNZ } from '../../utils/date'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'
import {
  PlusIcon, TrashIcon, CameraIcon,
  CheckCircleIcon, MoneyIcon, ArrowRightIcon
} from '../icons'

const TABS = [
  { key: 'cashup', label: 'Cash Up' },
  { key: 'hrcash', label: 'HR Cash Management' },
]

export default function CashUpPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('cashup')

  const [selectedDate, setSelectedDate] = useState(getTodayNZ())
  const [closing, setClosing] = useState(null)
  const [loadingClosing, setLoadingClosing] = useState(true)

  // Bank deposit
  const [bankDeposit, setBankDeposit] = useState('')

  // HR Cash (simple amount)
  const [hrCashAmount, setHrCashAmount] = useState('')
  const [hrCashEntryId, setHrCashEntryId] = useState(null)
  const [hrCashEnabled, setHrCashEnabled] = useState(false)

  // HR Cash entries (for HR Cash tab balance calc)
  const [hrCashEntries, setHrCashEntries] = useState([])
  const [hrCashBalance, setHrCashBalance] = useState(0)
  const [hrNetBalance, setHrNetBalance] = useState(0)
  const [hrTotalExpenses, setHrTotalExpenses] = useState(0)
  const [showHrForm, setShowHrForm] = useState(false)
  const [hrForm, setHrForm] = useState({ recipient_name: '', amount: '', notes: '', photo: null })

  // Cash Expenses
  const [expenses, setExpenses] = useState([])
  const [showExpForm, setShowExpForm] = useState(false)
  const [expForm, setExpForm] = useState({ category: 'SUPPLIES', reason: '', amount: '', notes: '', attachment: null })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Missing days
  const [missingDays, setMissingDays] = useState([])

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  const showMsg = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // Check for missing (uncompleted) days in the last 7 days
  useEffect(() => {
    const checkMissingDays = async () => {
      try {
        const today = new Date()
        const missing = []
        for (let i = 1; i <= 7; i++) {
          const d = new Date(today)
          d.setDate(today.getDate() - i)
          const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
          try {
            const res = await closingAPI.getByDate(dateStr)
            const data = res.data.results || res.data || []
            if (data.length === 0 || !['SUBMITTED', 'APPROVED'].includes(data[0].status)) {
              missing.push(dateStr)
            }
          } catch {
            missing.push(dateStr)
          }
        }
        setMissingDays(missing)
      } catch {
        // ignore
      }
    }
    checkMissingDays()
  }, [])

  // Load total HR Cash balance (cumulative across all dates)
  const loadHrCashBalance = async () => {
    try {
      const res = await hrCashAPI.balance()
      setHrCashBalance(parseFloat(res.data.balance) || 0)
      setHrNetBalance(parseFloat(res.data.net_balance) || 0)
      setHrTotalExpenses(parseFloat(res.data.expenses) || 0)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadHrCashBalance()
  }, [])

  // Load closing for selected date
  useEffect(() => {
    const loadClosing = async () => {
      setLoadingClosing(true)
      try {
        const res = await closingAPI.getByDate(selectedDate)
        const data = res.data.results || res.data || []
        if (data.length > 0) {
          // Fetch detail for full data (hr_cash_enabled, hr_cash_entries)
          const detailRes = await closingAPI.get(data[0].id)
          const c = detailRes.data
          setClosing(c)
          setBankDeposit(c.bank_deposit || '')
          setHrCashEnabled(c.hr_cash_enabled || false)
          // HR Cash simple amount from entries
          const hrEntries = c.hr_cash_entries || []
          if (hrEntries.length > 0) {
            setHrCashAmount(hrEntries[0].amount || '')
            setHrCashEntryId(hrEntries[0].id)
          } else {
            setHrCashAmount('')
            setHrCashEntryId(null)
          }
          loadHrCash(c.id)
          loadExpenses(c.id)
        } else {
          setClosing(null)
          setBankDeposit('')
          setHrCashAmount('')
          setHrCashEntryId(null)
          setHrCashEntries([])
          setExpenses([])
        }
      } catch {
        setClosing(null)
      } finally {
        setLoadingClosing(false)
      }
    }
    loadClosing()
  }, [selectedDate, activeTab])

  const loadHrCash = async (closingId) => {
    try {
      const res = await hrCashAPI.list({ closing_id: closingId })
      setHrCashEntries(res.data.results || res.data || [])
    } catch { setHrCashEntries([]) }
  }

  const loadExpenses = async (closingId) => {
    try {
      const res = await cashExpenseAPI.list({ closing_id: closingId })
      setExpenses(res.data.results || res.data || [])
    } catch { setExpenses([]) }
  }

  // Save bank deposit
  const handleSaveBankDeposit = async () => {
    if (!closing) return
    setSaving(true)
    setError('')
    try {
      await closingAPI.patch(closing.id, { bank_deposit: bankDeposit || 0 })
      showMsg('Bank deposit saved')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Auto-create closing if needed (for HR Cash tab)
  const ensureClosing = async () => {
    if (closing) return closing
    try {
      const res = await closingAPI.create({
        organization: user?.organization,
        closing_date: selectedDate,
        pos_card: 0, pos_cash: 0, actual_card: 0, actual_cash: 0, tab_count: 0,
      })
      setClosing(res.data)
      return res.data
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create closing')
      return null
    }
  }

  // Add HR Cash
  const handleAddHrCash = async (e) => {
    e.preventDefault()
    if (!hrForm.amount) return
    const c = await ensureClosing()
    if (!c) return
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('daily_closing', c.id)
      fd.append('amount', hrForm.amount)
      if (hrForm.recipient_name) fd.append('recipient_name', hrForm.recipient_name)
      if (hrForm.notes) fd.append('notes', hrForm.notes)
      if (hrForm.photo) fd.append('photo', hrForm.photo)

      await hrCashAPI.create(fd)
      setHrForm({ recipient_name: '', amount: '', notes: '', photo: null })
      setShowHrForm(false)
      loadHrCash(c.id)
      showMsg('HR cash added')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add HR cash')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteHrCash = async (id) => {
    try {
      await hrCashAPI.delete(id)
      setHrCashEntries(prev => prev.filter(e => e.id !== id))
    } catch { setError('Failed to delete') }
  }

  // Add Expense
  const handleAddExpense = async (e) => {
    e.preventDefault()
    if (!expForm.amount || !expForm.reason) return
    const c = await ensureClosing()
    if (!c) return
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('daily_closing', c.id)
      fd.append('category', expForm.category)
      fd.append('reason', expForm.reason)
      fd.append('amount', expForm.amount)
      if (expForm.notes) fd.append('notes', expForm.notes)
      if (expForm.attachment) fd.append('attachment', expForm.attachment)

      await cashExpenseAPI.create(fd)
      setExpForm({ category: 'SUPPLIES', reason: '', amount: '', notes: '', attachment: null })
      setShowExpForm(false)
      loadExpenses(c.id)
      loadHrCashBalance()
      showMsg('Expense added')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add expense')
    } finally {
      setSaving(false)
    }
  }

  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const handleDeleteExpense = async (id) => {
    try {
      await cashExpenseAPI.delete(id)
      setExpenses(prev => prev.filter(e => e.id !== id))
      loadHrCashBalance()
      setDeleteConfirmId(null)
      showMsg('Expense deleted')
    } catch { setError('Failed to delete') }
  }

  // HR Cash tab: Save expense + approve + return to HR Cash Management
  const handleHrSaveApprove = async () => {
    const c = await ensureClosing()
    if (!c) return
    setSaving(true)
    setError('')
    try {
      // Save expense if form has data
      if (expForm.amount && expForm.reason) {
        const fd = new FormData()
        fd.append('daily_closing', c.id)
        fd.append('category', expForm.category)
        fd.append('reason', expForm.reason)
        fd.append('amount', expForm.amount)
        if (expForm.notes) fd.append('notes', expForm.notes)
        if (expForm.attachment) fd.append('attachment', expForm.attachment)
        await cashExpenseAPI.create(fd)
      }
      // Approve
      const res = await closingAPI.approve(c.id)
      setClosing(res.data)
      setExpForm({ category: 'SUPPLIES', reason: '', amount: '', notes: '', attachment: null })
      loadHrCashBalance()
      loadExpenses(c.id)
      showMsg('Saved & Approved')
      // Switch back to show updated state
      setActiveTab('hr')
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Sync HR Cash (single entry)
  const syncHrCash = async (closingId) => {
    const val = parseFloat(hrCashAmount)
    if (val && val > 0) {
      const fd = new FormData()
      fd.append('daily_closing', closingId)
      fd.append('amount', val)
      if (hrCashEntryId) {
        await hrCashAPI.update(hrCashEntryId, fd)
      } else {
        const res = await hrCashAPI.create(fd)
        setHrCashEntryId(res.data.id)
      }
    } else if (hrCashEntryId) {
      await hrCashAPI.delete(hrCashEntryId)
      setHrCashEntryId(null)
    }
  }

  const getErrorMsg = (err) => {
    const d = err.response?.data
    if (!d) return err.message || 'Network error'
    if (typeof d === 'string') return d
    if (d.detail) return d.detail
    // Validation errors: { field: ["error"] }
    const msgs = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    return msgs.join('; ') || 'Failed to save'
  }

  // Save cash up only (bank deposit + HR cash, no status change)
  const handleSaveCashUp = async () => {
    if (!closing) return
    setSaving(true)
    setError('')
    try {
      await closingAPI.patch(closing.id, { bank_deposit: parseFloat(bankDeposit) || 0 })
      await syncHrCash(closing.id)
      await loadHrCash(closing.id)
      loadHrCashBalance()
      showMsg('Cash up saved')
    } catch (err) {
      setError(getErrorMsg(err))
    } finally {
      setSaving(false)
    }
  }

  // Save & Submit (save bank_deposit + HR cash, then approve)
  const handleSaveAndSubmit = async () => {
    if (!closing) return
    setSaving(true)
    setError('')
    try {
      await closingAPI.patch(closing.id, { bank_deposit: parseFloat(bankDeposit) || 0 })
      await syncHrCash(closing.id)
      await loadHrCash(closing.id)
      loadHrCashBalance()
      const res = await closingAPI.approve(closing.id)
      setClosing(res.data)
      showMsg('Saved & Approved')
    } catch (err) {
      setError(getErrorMsg(err))
    } finally {
      setSaving(false)
    }
  }

  const isLocked = closing && closing.status === 'APPROVED'

  // Calculations
  const deposit = parseFloat(bankDeposit) || 0
  const expenseTotal = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const hrCashFromEntries = hrCashEntries.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const hrCashTotal = hrCashFromEntries || parseFloat(hrCashAmount) || 0
  const totalCash = deposit + expenseTotal + hrCashTotal
  const actualCash = parseFloat(closing?.actual_cash || 0)
  const cashVariance = actualCash - totalCash

  const formatDateShort = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Cash Management</h1>
        <p className="text-sm text-gray-400 mt-0.5">Reconcile cash & HR cash for the day</p>
      </div>

      {/* Tabs */}
      <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Missing days alert (Cash Up tab only) */}
      {activeTab === 'cashup' && missingDays.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-700 mb-2">
            {missingDays.length} day{missingDays.length > 1 ? 's' : ''} not completed
          </p>
          <div className="flex flex-wrap gap-2">
            {missingDays.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-lg hover:bg-red-200 transition font-medium"
              >
                {formatDateShort(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

      {/* Date Picker (Cash Up tab only) */}
      {activeTab === 'cashup' && (
        <Card className="p-5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={`${inputCls} mt-2`}
          />
        </Card>
      )}

      {loadingClosing ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'cashup' && !closing ? (
        <Card className="p-8 text-center">
          <p className="text-gray-400 text-sm">No closing found for this date</p>
          <p className="text-gray-300 text-xs mt-1">Staff must create a closing first</p>
        </Card>
      ) : activeTab === 'cashup' && closing ? (
        /* ============ CASH UP TAB ============ */
        <>
          {closing.status === 'APPROVED' ? (
            /* ---- Approved: Read-only summary ---- */
            <>
              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Cash Up Summary</span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">✓ Approved</span>
                </div>
                <div className="border-t border-gray-100" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Actual Cash</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(closing.actual_cash)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Bank Deposit</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(bankDeposit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">HR Cash</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(hrCashAmount)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Remaining</span>
                    <span className={`text-lg font-bold ${(actualCash - deposit - (parseFloat(hrCashAmount) || 0)) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(actualCash - deposit - (parseFloat(hrCashAmount) || 0))}
                    </span>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            /* ---- Not approved: Editable form ---- */
            <>
              <Card className="p-5 space-y-4">
                {/* Actual Cash */}
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Actual Cash</span>
                    <span className="text-xl font-bold text-gray-900">{fmt(closing.actual_cash)}</span>
                  </div>
                  <div className="mt-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      closing.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {closing.status}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                {/* Bank Deposit */}
                <div>
                  <label className="text-sm font-medium text-gray-500 block mb-1.5">Bank Deposit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bankDeposit}
                    onChange={(e) => setBankDeposit(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>

                {/* HR Cash */}
                <div>
                  <label className="text-sm font-medium text-gray-500 block mb-1.5">HR Cash</label>
                  <input
                    type="number"
                    step="0.01"
                    value={hrCashAmount}
                    onChange={(e) => setHrCashAmount(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Remaining Cash</span>
                    <span className={`text-xl font-bold ${(actualCash - deposit - (parseFloat(hrCashAmount) || 0)) === 0 ? 'text-green-600' : (actualCash - deposit - (parseFloat(hrCashAmount) || 0)) > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {fmt(actualCash - deposit - (parseFloat(hrCashAmount) || 0))}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Save & Approve */}
              <div className="space-y-3 pb-6">
                <button
                  onClick={handleSaveAndSubmit}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
                >
                  <CheckCircleIcon size={18} />
                  {saving ? 'Saving...' : 'Save & Approve'}
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        /* ============ HR CASH TAB ============ */
        <>
          {/* Current Balance */}
          <Card className="p-5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Current Balance</span>
              <span className={`text-xl font-bold ${hrNetBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(hrNetBalance)}</span>
            </div>
          </Card>

          {/* Expense */}
          <Card className="p-5">
            <SectionLabel>Expense</SectionLabel>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Account</label>
                  <select
                    value={expForm.reason}
                    onChange={(e) => setExpForm(p => ({ ...p, reason: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Select</option>
                    <option value="ChCh">ChCh</option>
                    <option value="QT">QT</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expForm.amount}
                    onChange={(e) => setExpForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <input
                  value={expForm.notes}
                  onChange={(e) => setExpForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition">
                  <CameraIcon size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {expForm.attachment ? expForm.attachment.name : 'Tap to attach photo'}
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => setExpForm(p => ({ ...p, attachment: e.target.files[0] }))}
                    className="hidden"
                  />
                </label>
              </div>
            </form>
          </Card>

          {/* Net Balance */}
          <Card className="p-5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Net Balance</span>
              <span className={`text-xl font-bold ${hrNetBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(hrNetBalance)}
              </span>
            </div>
          </Card>

          {/* Save & Approve */}
          <button
            onClick={handleHrSaveApprove}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            <CheckCircleIcon size={18} />
            {saving ? 'Saving...' : 'Save & Approve'}
          </button>
        </>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { closingAPI, hrCashAPI, cashExpenseAPI } from '../../services/api'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'
import {
  PlusIcon, TrashIcon, CameraIcon,
  CheckCircleIcon, MoneyIcon, ArrowRightIcon
} from '../icons'

const TABS = [
  { key: 'cashup', label: 'Cash Up' },
  { key: 'hrcash', label: 'HR Cash' },
]

export default function CashUpPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('cashup')

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
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
  const [showHrForm, setShowHrForm] = useState(false)
  const [hrForm, setHrForm] = useState({ recipient_name: '', amount: '', notes: '', photo: null })

  // Cash Expenses
  const [expenses, setExpenses] = useState([])
  const [showExpForm, setShowExpForm] = useState(false)
  const [expForm, setExpForm] = useState({ category: 'SUPPLIES', reason: '', amount: '', attachment: null })

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
          const dateStr = d.toISOString().split('T')[0]
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
  }, [selectedDate])

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

  // Add HR Cash
  const handleAddHrCash = async (e) => {
    e.preventDefault()
    if (!closing || !hrForm.amount) return
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('daily_closing', closing.id)
      fd.append('amount', hrForm.amount)
      if (hrForm.recipient_name) fd.append('recipient_name', hrForm.recipient_name)
      if (hrForm.notes) fd.append('notes', hrForm.notes)
      if (hrForm.photo) fd.append('photo', hrForm.photo)

      await hrCashAPI.create(fd)
      setHrForm({ recipient_name: '', amount: '', notes: '', photo: null })
      setShowHrForm(false)
      loadHrCash(closing.id)
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
    if (!closing || !expForm.amount || !expForm.reason) return
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('daily_closing', closing.id)
      fd.append('category', expForm.category)
      fd.append('reason', expForm.reason)
      fd.append('amount', expForm.amount)
      if (expForm.attachment) fd.append('attachment', expForm.attachment)

      await cashExpenseAPI.create(fd)
      setExpForm({ category: 'SUPPLIES', reason: '', amount: '', attachment: null })
      setShowExpForm(false)
      loadExpenses(closing.id)
      showMsg('Expense added')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteExpense = async (id) => {
    try {
      await cashExpenseAPI.delete(id)
      setExpenses(prev => prev.filter(e => e.id !== id))
    } catch { setError('Failed to delete') }
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

  // Save cash up only (bank deposit + HR cash, no status change)
  const handleSaveCashUp = async () => {
    if (!closing) return
    setSaving(true)
    setError('')
    try {
      await closingAPI.patch(closing.id, { bank_deposit: bankDeposit || 0 })
      await syncHrCash(closing.id)
      showMsg('Cash up saved')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
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
      await closingAPI.patch(closing.id, { bank_deposit: bankDeposit || 0 })
      await syncHrCash(closing.id)
      const res = await closingAPI.approve(closing.id)
      setClosing(res.data)
      showMsg('Saved & Approved')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Calculations
  const deposit = parseFloat(bankDeposit) || 0
  const expenseTotal = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const hrCashTotal = hrCashEntries.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
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
        <h1 className="text-xl font-bold text-gray-900">Cash Up</h1>
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

      {/* Missing days alert */}
      {missingDays.length > 0 && (
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

      {/* Date Picker */}
      <Card className="p-5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className={`${inputCls} mt-2`}
        />
      </Card>

      {loadingClosing ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !closing ? (
        <Card className="p-8 text-center">
          <p className="text-gray-400 text-sm">No closing found for this date</p>
          <p className="text-gray-300 text-xs mt-1">Staff must create a closing first</p>
        </Card>
      ) : activeTab === 'cashup' ? (
        /* ============ CASH UP TAB ============ */
        <>
          {/* Cash Summary from Daily Closing */}
          <Card className="p-5 bg-gray-900 border-gray-800">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Daily Closing Summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">POS Cash</span>
                <span className="text-white font-medium">{fmt(closing.pos_cash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">POS Card</span>
                <span className="text-white font-medium">{fmt(closing.pos_card)}</span>
              </div>
              <div className="border-t border-gray-700 pt-2 mt-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300 font-medium">POS Total</span>
                  <span className="text-white font-bold">{fmt(closing.pos_total)}</span>
                </div>
              </div>
              <div className="border-t border-gray-700 pt-2 mt-1" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Actual Cash</span>
                <span className="text-white font-medium">{fmt(closing.actual_cash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Actual Card</span>
                <span className="text-white font-medium">{fmt(closing.actual_card)}</span>
              </div>
              <div className="border-t border-gray-700 pt-2 mt-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300 font-medium">Actual Total</span>
                  <span className="text-white font-bold">{fmt(closing.actual_total)}</span>
                </div>
              </div>
              {parseFloat(closing.total_variance || 0) !== 0 && (
                <div className="border-t border-gray-700 pt-2 mt-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300 font-medium">Variance</span>
                    <span className={`font-bold ${parseFloat(closing.total_variance || 0) === 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(closing.total_variance)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 pt-2 border-t border-gray-700">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  closing.status === 'APPROVED' ? 'bg-green-900 text-green-300' :
                  closing.status === 'SUBMITTED' ? 'bg-blue-900 text-blue-300' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {closing.status}
                </span>
                {closing.created_by_name && (
                  <span className="text-xs text-gray-500">by {closing.created_by_name}</span>
                )}
              </div>
            </div>
          </Card>

          {/* Bank Deposit */}
          <Card className="p-5">
            <SectionLabel>Bank Deposit</SectionLabel>
            <input
              type="number"
              step="0.01"
              value={bankDeposit}
              onChange={(e) => setBankDeposit(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </Card>

          {/* HR Cash */}
          {hrCashEnabled && (
            <Card className="p-5">
              <SectionLabel>HR Cash</SectionLabel>
              <input
                type="number"
                step="0.01"
                value={hrCashAmount}
                onChange={(e) => setHrCashAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Card>
          )}

          {/* Cash Reconciliation */}
          <Card className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cash Reconciliation</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Actual Cash</span>
                <span className="font-medium text-gray-900">{fmt(closing.actual_cash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bank Deposit</span>
                <span className="font-medium text-gray-900">-{fmt(deposit)}</span>
              </div>
              {hrCashTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">HR Cash</span>
                  <span className="font-medium text-gray-900">-{fmt(hrCashTotal)}</span>
                </div>
              )}
              {expenseTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Expenses</span>
                  <span className="font-medium text-gray-900">-{fmt(expenseTotal)}</span>
                </div>
              )}
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700">Remaining Cash</span>
                  <span className={`font-bold text-lg ${cashVariance === 0 ? 'text-green-600' : cashVariance > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {fmt(cashVariance)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="space-y-3 pb-6">
            {closing.status !== 'APPROVED' ? (
              <button
                onClick={handleSaveAndSubmit}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
              >
                <CheckCircleIcon size={18} />
                {saving ? 'Saving...' : 'Save & Approve'}
              </button>
            ) : (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                  <p className="text-sm text-green-700 font-medium">✓ Approved</p>
                </div>
                <button
                  onClick={handleSaveCashUp}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  <CheckCircleIcon size={18} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}

            <button
              onClick={() => navigate(`/closing/form?date=${selectedDate}`)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
            >
              View Daily Closing
              <ArrowRightIcon size={14} />
            </button>
          </div>
        </>
      ) : (
        /* ============ HR CASH TAB ============ */
        <>
          {/* Expense Input — always visible */}
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
              <button
                type="submit"
                disabled={saving || !expForm.amount || !expForm.reason}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </form>
          </Card>

          {/* Balance */}
          <Card className="p-5 bg-gray-900 border-gray-800">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">HR Cash</span>
                <span className="text-white font-medium">{fmt(hrCashTotal)}</span>
              </div>
              <div className="border-t border-gray-700 pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300 font-medium">Balance</span>
                  <span className="text-white font-bold">{fmt(hrCashTotal)}</span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Expenses</span>
                <span className="text-red-400 font-medium">-{fmt(expenseTotal)}</span>
              </div>
              <div className="border-t border-gray-700 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-gray-300 font-medium">Net Balance</span>
                  <span className={`text-lg font-bold ${(hrCashTotal - expenseTotal) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt(hrCashTotal - expenseTotal)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

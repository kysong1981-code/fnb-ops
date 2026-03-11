import { useState, useEffect, Fragment } from 'react'
import { useAuth } from '../../context/AuthContext'
import { cqAPI } from '../../services/api'
import Card from '../ui/Card'
import { PlusIcon, TrashIcon, CheckCircleIcon, CameraIcon } from '../icons'

const ACCOUNTS = [
  { key: 'CHCH', label: 'ChCh', currency: 'NZD' },
  { key: 'QT', label: 'QT', currency: 'NZD' },
  { key: 'KRW', label: 'KRW', currency: 'KRW' },
]

const DATE_MODES = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'custom', label: 'Custom' },
]

function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { start: localDateStr(mon), end: localDateStr(sun) }
}

function getMonthRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: localDateStr(start), end: localDateStr(end) }
}

export default function CQReport() {
  const { user } = useAuth()

  // Date controls
  const [dateMode, setDateMode] = useState('month')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [balances, setBalances] = useState({})
  const [balanceInputs, setBalanceInputs] = useState({})
  const [expenses, setExpenses] = useState([])
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [ledgerTab, setLedgerTab] = useState('CHCH')
  const [search, setSearch] = useState('')
  const [expandedDate, setExpandedDate] = useState(null)

  // New expense form per account
  const [expForms, setExpForms] = useState({
    CHCH: { description: '', amount: '', attachment: null, category: 'EXPENSE', exchangeRate: '', krwAmount: '' },
    QT: { description: '', amount: '', attachment: null, category: 'EXPENSE', exchangeRate: '', krwAmount: '' },
    KRW: { description: '', amount: '', attachment: null, category: 'EXPENSE' },
  })

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtKrw = (v) => `₩${Math.round(parseFloat(v || 0)).toLocaleString('en-US')}`
  const fmtAuto = (v, currency) => currency === 'KRW' ? fmtKrw(v) : fmt(v)

  const inputCls = 'px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const dateInputCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  const showMsg = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const getDateRange = () => {
    if (dateMode === 'day') return { start: date, end: date }
    if (dateMode === 'week') return getWeekRange(date)
    if (dateMode === 'month') return getMonthRange(date)
    if (dateMode === 'custom') return { start: startDate, end: endDate }
    return { start: date, end: date }
  }

  const formatShortDate = (d) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const getDateRangeLabel = () => {
    if (dateMode === 'week') {
      const { start, end } = getWeekRange(date)
      return `${formatShortDate(start)} — ${formatShortDate(end)}`
    }
    if (dateMode === 'month') {
      const d = new Date(date + 'T00:00:00')
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    }
    return null
  }

  useEffect(() => {
    if (dateMode === 'custom') {
      if (startDate && endDate) loadData()
    } else {
      loadData()
    }
  }, [date, startDate, endDate, dateMode])

  const loadData = async () => {
    setLoading(true)
    try {
      const range = getDateRange()
      const [balRes, expRes, ledgerRes] = await Promise.all([
        cqAPI.getBalances(),
        cqAPI.listExpenses({ date_start: range.start, date_end: range.end }),
        cqAPI.combinedLedger({ date_start: range.start, date_end: range.end }),
      ])
      const bals = {}
      const inputs = {}
      ;(balRes.data.results || balRes.data || []).forEach(b => {
        bals[b.account] = b
        inputs[b.account] = String(b.balance)
      })
      setBalances(bals)
      setBalanceInputs(inputs)
      setExpenses(expRes.data.results || expRes.data || [])
      setLedger(ledgerRes.data || [])
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBalance = async (account) => {
    setSaving(true)
    setError('')
    try {
      const res = await cqAPI.updateBalance({ account, balance: balanceInputs[account] || 0 })
      setBalances(prev => ({ ...prev, [account]: res.data }))
      showMsg(`${account === 'CHCH' ? 'ChCh' : 'QT'} balance saved`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save balance')
    } finally { setSaving(false) }
  }

  const handleAddExpense = async (account) => {
    const form = expForms[account]
    if (!form.description || !form.amount) return
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('account', account)
      fd.append('category', form.category || 'EXPENSE')
      fd.append('description', form.description)
      fd.append('amount', form.amount)
      fd.append('date', new Date().toISOString().split('T')[0])
      if (form.category === 'EXCHANGE' && form.krwAmount) fd.append('krw_amount', form.krwAmount)
      if (form.attachment) fd.append('attachment', form.attachment)
      await cqAPI.createExpense(fd)
      setExpForms(prev => ({ ...prev, [account]: { description: '', amount: '', attachment: null, category: 'EXPENSE', exchangeRate: '', krwAmount: '' } }))
      const range = getDateRange()
      const res = await cqAPI.listExpenses({ date_start: range.start, date_end: range.end })
      setExpenses(res.data.results || res.data || [])
      showMsg('Expense added')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add expense')
    } finally { setSaving(false) }
  }

  const handleApprove = async (id) => {
    setSaving(true)
    setError('')
    try {
      await cqAPI.approveExpense(id)
      const range = getDateRange()
      const res = await cqAPI.listExpenses({ date_start: range.start, date_end: range.end })
      setExpenses(res.data.results || res.data || [])
      showMsg('Expense approved')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to approve')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await cqAPI.deleteExpense(id)
      setExpenses(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete')
    }
  }

  // Computed
  const pendingToApprove = expenses.filter(e => e.status === 'PENDING' && user && e.created_by !== user.id)
  const pendingWaiting = expenses.filter(e => e.status === 'PENDING' && user && e.created_by === user.id)


  return (
    <div className="space-y-6">
      {/* Date Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Period</label>
            <div className="bg-gray-100 rounded-lg p-0.5 flex gap-0.5">
              {DATE_MODES.map((dm) => (
                <button
                  key={dm.key}
                  onClick={() => setDateMode(dm.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    dateMode === dm.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {dm.label}
                </button>
              ))}
            </div>
          </div>
          {dateMode !== 'custom' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                {dateMode === 'month' ? 'Month' : dateMode === 'week' ? 'Week of' : 'Date'}
              </label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={dateInputCls} />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">From</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={dateInputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">To</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={dateInputCls} />
              </div>
            </>
          )}
          {dateMode !== 'day' && dateMode !== 'custom' && (
            <div className="pb-2">
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">{getDateRangeLabel()}</span>
            </div>
          )}
        </div>
      </Card>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ─── 1. PENDING ACTIONS (Approve / Waiting) ─── */}
          {(pendingToApprove.length > 0 || pendingWaiting.length > 0) && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Pending Actions</h3>

              {pendingToApprove.length > 0 && (
                <div className="mb-4">
                  <label className="text-xs font-semibold text-orange-600 mb-2 block">
                    To Approve ({pendingToApprove.length})
                  </label>
                  <div className="space-y-2">
                    {pendingToApprove.map(exp => (
                      <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                              {exp.account === 'CHCH' ? 'ChCh' : 'QT'}
                            </span>
                            {exp.category === 'TRANSFER' && (
                              <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">Transfer</span>
                            )}
                            <p className="text-sm font-medium text-gray-900 truncate">{exp.description}</p>
                            {exp.attachment && <span className="text-xs text-blue-500">📎</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{exp.date}</span>
                            <span className="text-xs text-gray-400">by {exp.created_by_name}</span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 shrink-0">{fmt(exp.amount)}</span>
                        <button
                          onClick={() => handleApprove(exp.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition"
                        >
                          <CheckCircleIcon size={14} /> Approve
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingWaiting.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-amber-600 mb-2 block">
                    Waiting for Approval ({pendingWaiting.length})
                  </label>
                  <div className="space-y-2">
                    {pendingWaiting.map(exp => (
                      <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                              {exp.account === 'CHCH' ? 'ChCh' : 'QT'}
                            </span>
                            <p className="text-sm font-medium text-gray-900 truncate">{exp.description}</p>
                            {exp.attachment && <span className="text-xs text-blue-500">📎</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{exp.date}</span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 shrink-0">{fmt(exp.amount)}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-amber-500 font-medium px-2 py-1 bg-amber-100 rounded-lg">Waiting</span>
                          <button onClick={() => handleDelete(exp.id)} className="text-gray-300 hover:text-red-500 transition p-1">
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ─── 2. NEW EXPENSE + BALANCE (per account) ─── */}
          {ACCOUNTS.map(({ key, label, currency }) => {
            const bal = balances[key]
            const form = expForms[key]
            const isKrw = currency === 'KRW'
            const fmtC = (v) => isKrw ? fmtKrw(v) : fmt(v)
            const acctExpenses = expenses.filter(e => e.account === key)
            const approvedTotal = acctExpenses.filter(e => e.status === 'APPROVED').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
            const netBalance = parseFloat(balanceInputs[key] || bal?.balance || 0) - approvedTotal

            // Category options: ChCh/QT get Expense+Transfer+Exchange, KRW only Expense
            const categories = isKrw
              ? [{ key: 'EXPENSE', label: 'Expense' }]
              : [
                  { key: 'EXPENSE', label: 'Expense' },
                  { key: 'TRANSFER', label: 'Transfer' },
                  { key: 'EXCHANGE', label: 'Exchange' },
                ]

            return (
              <Card key={key} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{label}</h3>
                  <span className={`text-lg font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtC(netBalance)}</span>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-1 block">Starting Balance</label>
                  <div className="flex gap-2">
                    <input type="text" inputMode="decimal" value={balanceInputs[key] || ''} onChange={(e) => setBalanceInputs(prev => ({ ...prev, [key]: e.target.value }))} placeholder={isKrw ? '0' : '0.00'} className={`${inputCls} flex-1`} />
                    <button onClick={() => handleSaveBalance(key)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">Save</button>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl">
                  {/* Category toggle */}
                  {categories.length > 1 && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-gray-200 rounded-lg p-0.5 flex gap-0.5">
                        {categories.map(cat => (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => setExpForms(prev => ({ ...prev, [key]: { ...prev[key], category: cat.key } }))}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                              form.category === cat.key
                                ? cat.key === 'TRANSFER' ? 'bg-white text-purple-700 shadow-sm'
                                  : cat.key === 'EXCHANGE' ? 'bg-white text-teal-700 shadow-sm'
                                  : 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                      {form.category === 'TRANSFER' && (
                        <span className="text-[11px] text-purple-500">→ {key === 'CHCH' ? 'QT' : 'ChCh'}</span>
                      )}
                      {form.category === 'EXCHANGE' && (
                        <span className="text-[11px] text-teal-500">→ KRW</span>
                      )}
                    </div>
                  )}

                  <div className="mb-2">
                    <input type="text" value={form.description} onChange={(e) => setExpForms(prev => ({ ...prev, [key]: { ...prev[key], description: e.target.value } }))} placeholder="내역 (Description)" className={`${inputCls} w-full`} />
                  </div>

                  {/* Amount row */}
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) { setExpForms(prev => ({ ...prev, [key]: { ...prev[key], amount: v } })) } }}
                      placeholder={form.category === 'EXCHANGE' ? 'NZD Amount' : isKrw ? 'KRW Amount' : 'Amount (0.00)'}
                      className={`${inputCls} flex-1`}
                    />
                    {form.category !== 'EXCHANGE' && (
                      <button onClick={() => handleAddExpense(key)} disabled={saving || !form.description || !form.amount} className="shrink-0 flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition">
                        <PlusIcon size={14} /> Add
                      </button>
                    )}
                  </div>

                  {/* Exchange: KRW amount row */}
                  {form.category === 'EXCHANGE' && (
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.krwAmount || ''}
                        onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) { setExpForms(prev => ({ ...prev, [key]: { ...prev[key], krwAmount: v } })) } }}
                        placeholder="₩ KRW Amount"
                        className={`${inputCls} flex-1`}
                      />
                      <button onClick={() => handleAddExpense(key)} disabled={saving || !form.description || !form.amount || !form.krwAmount} className="shrink-0 flex items-center gap-1 px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 disabled:opacity-40 transition">
                        <PlusIcon size={14} /> Add
                      </button>
                    </div>
                  )}

                  <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition">
                    <CameraIcon size={16} className="text-gray-400" />
                    <span className="text-xs text-gray-500">{form.attachment ? form.attachment.name : 'Tap to attach photo'}</span>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setExpForms(prev => ({ ...prev, [key]: { ...prev[key], attachment: e.target.files[0] || null } }))} className="hidden" />
                  </label>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500"><span>Starting Balance</span><span>{fmtC(balanceInputs[key] || bal?.balance || 0)}</span></div>
                  <div className="flex justify-between text-xs text-gray-500"><span>Approved Expenses</span><span className="text-red-500">-{fmtC(approvedTotal)}</span></div>
                  <div className="flex justify-between pt-1.5 border-t border-gray-100">
                    <span className="text-sm font-semibold text-gray-700">Net Balance</span>
                    <span className={`text-sm font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtC(netBalance)}</span>
                  </div>
                </div>
              </Card>
            )
          })}

          {/* ─── 3. ACCOUNT LEDGER TABLE (ChCh / QT / KRW) ─── */}
          <Card className="overflow-hidden">
            {/* Tab toggle */}
            <div className="flex items-center gap-2 p-4 pb-0">
              <div className="bg-gray-100 rounded-lg p-0.5 flex gap-0.5 flex-1">
                {ACCOUNTS.map(({ key: ak, label: al }) => (
                  <button
                    key={ak}
                    onClick={() => { setLedgerTab(ak); setSearch(''); setExpandedDate(null) }}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition ${
                      ledgerTab === ak
                        ? ak === 'KRW' ? 'bg-white text-teal-700 shadow-sm'
                          : ak === 'QT' ? 'bg-white text-purple-700 shadow-sm'
                          : 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {al}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {(() => {
              const acctKey = ledgerTab
              const acctMeta = ACCOUNTS.find(a => a.key === acctKey)
              const acctLabel = acctMeta?.label || acctKey
              const isKrwTab = acctKey === 'KRW'
              const tabFmt = (v) => isKrwTab ? fmtKrw(v) : fmt(v)
              const acctItems = ledger.filter(e =>
                e.account === acctLabel || e.account === acctKey
              )

              // Group by date
              const byDate = {}
              acctItems.forEach(e => {
                if (!byDate[e.date]) byDate[e.date] = []
                byDate[e.date].push(e)
              })
              const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

              const bal = balances[acctKey]
              const startBal = parseFloat(balanceInputs[acctKey] || bal?.balance || 0)
              // Totals: "in" sources = hr_cash, transfer_in, exchange_in; "out" = cq
              const totalHrCash = acctItems.filter(e => e.source === 'hr_cash').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
              const totalTfIn = acctItems.filter(e => e.source === 'transfer_in').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
              const totalTfOut = acctItems.filter(e => e.source === 'cq' && e.category === 'TRANSFER').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
              const totalExIn = acctItems.filter(e => e.source === 'exchange_in').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
              const totalExOut = acctItems.filter(e => e.source === 'cq' && e.category === 'EXCHANGE').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
              const totalExpense = acctItems.filter(e => e.source === 'cq' && e.category === 'EXPENSE').reduce((s, e) => s + parseFloat(e.amount || 0), 0)

              // Running balance per date (chronological)
              const chronoDates = [...sortedDates].reverse()
              const runningBals = {}
              let runBal = startBal
              chronoDates.forEach(d => {
                const items = byDate[d]
                const dayIn = items.filter(e => ['hr_cash', 'transfer_in', 'exchange_in'].includes(e.source)).reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                const dayOut = items.filter(e => e.source === 'cq').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                runBal = runBal + dayIn - dayOut
                runningBals[d] = runBal
              })

              const fmtShortDate = (dateStr) => {
                const d = new Date(dateStr + 'T00:00:00')
                return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              }

              if (sortedDates.length === 0) {
                return <p className="text-gray-400 text-sm text-center py-8">No transactions for this period.</p>
              }

              // Column count for colSpan
              const colCount = isKrwTab ? 4 : 5

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: isKrwTab ? 550 : 700 }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-3 font-semibold text-gray-600">Date</th>
                        {isKrwTab ? (
                          <th className="text-right px-3 py-3 font-semibold text-teal-600">Exchange In</th>
                        ) : (
                          <>
                            <th className="text-right px-3 py-3 font-semibold text-green-600">HR Cash</th>
                            <th className="text-right px-3 py-3 font-semibold text-purple-600">Transfer</th>
                          </>
                        )}
                        <th className="text-left px-3 py-3 font-semibold text-gray-600">Expenses</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedDates.map(dateKey => {
                        const items = byDate[dateKey]
                        const hrItems = items.filter(e => e.source === 'hr_cash')
                        const tfInItems = items.filter(e => e.source === 'transfer_in')
                        const tfOutItems = items.filter(e => e.source === 'cq' && e.category === 'TRANSFER')
                        const exInItems = items.filter(e => e.source === 'exchange_in')
                        const exOutItems = items.filter(e => e.source === 'cq' && e.category === 'EXCHANGE')
                        const expItems = items.filter(e => e.source === 'cq' && e.category === 'EXPENSE')
                        const dayHr = hrItems.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                        const dayTfIn = tfInItems.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                        const dayTfOut = tfOutItems.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                        const dayTfNet = dayTfIn - dayTfOut
                        const dayExIn = exInItems.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                        const dayExOut = exOutItems.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                        const dayExp = expItems.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                        const dayBalance = runningBals[dateKey]
                        const isExpanded = expandedDate === dateKey
                        const hasDetail = items.length > 0

                        const hrNames = hrItems.map(e => e.created_by_name).filter(Boolean)
                        const expSummary = expItems.map(e => e.description).join(', ')

                        return (
                          <Fragment key={dateKey}>
                            <tr className="hover:bg-gray-50/50 transition align-top cursor-pointer" onClick={() => hasDetail && setExpandedDate(isExpanded ? null : dateKey)}>
                              {/* Date */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="font-medium text-gray-900">{fmtShortDate(dateKey)}</span>
                              </td>

                              {isKrwTab ? (
                                /* KRW tab: Exchange In column */
                                <td className="px-3 py-2.5 text-right">
                                  {dayExIn > 0 ? (
                                    <span className="text-teal-600 font-medium">{fmtKrw(dayExIn)}</span>
                                  ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                  )}
                                </td>
                              ) : (
                                <>
                                  {/* HR Cash */}
                                  <td className="px-3 py-2.5 text-right">
                                    {dayHr > 0 ? (
                                      <>
                                        <span className="text-green-600 font-medium">{fmt(dayHr)}</span>
                                        {hrNames.length > 0 && (
                                          <p className="text-[11px] text-gray-400 truncate max-w-[120px] ml-auto">
                                            {[...new Set(hrNames)].join(', ')}
                                          </p>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-gray-300 text-xs">—</span>
                                    )}
                                  </td>

                                  {/* Transfer */}
                                  <td className="px-3 py-2.5 text-right">
                                    {dayTfIn > 0 || dayTfOut > 0 ? (
                                      <span className="font-medium text-purple-600">
                                        {dayTfNet >= 0 ? '+' : '-'}{fmt(Math.abs(dayTfNet))}
                                      </span>
                                    ) : dayExOut > 0 ? (
                                      <span className="font-medium text-teal-600">-{fmt(dayExOut)}</span>
                                    ) : (
                                      <span className="text-gray-300 text-xs">—</span>
                                    )}
                                  </td>
                                </>
                              )}

                              {/* Expenses */}
                              <td className="px-3 py-2.5">
                                {dayExp > 0 ? (
                                  <div className="text-left">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[10px] text-gray-400 transition-transform inline-block ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                      <span className="text-amber-600 font-medium">{tabFmt(dayExp)}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 truncate max-w-[180px]">
                                      {expSummary}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>

                              {/* Balance */}
                              <td className={`px-3 py-2.5 text-right font-semibold ${dayBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                {tabFmt(dayBalance)}
                              </td>
                            </tr>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <tr className="bg-gray-50/60">
                                <td colSpan={colCount} className="px-4 py-3">
                                  <div className="space-y-3">
                                    {/* HR Cash In detail */}
                                    {hrItems.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1.5">HR Cash</p>
                                        <div className="space-y-1.5">
                                          {hrItems.map(entry => (
                                            <div key={entry.id} className="bg-white rounded-lg border border-gray-100 p-2.5 flex items-center justify-between">
                                              <div>
                                                <span className="text-sm font-medium text-gray-900">{entry.description}</span>
                                                <p className="text-[11px] text-gray-400">by {entry.created_by_name}</p>
                                              </div>
                                              <span className="text-sm font-semibold text-green-600">+{fmt(entry.amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Exchange In detail */}
                                    {exInItems.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider mb-1.5">Exchange In</p>
                                        <div className="space-y-1.5">
                                          {exInItems.map(entry => (
                                            <div key={entry.id} className="bg-white rounded-lg border border-teal-100 p-2.5 flex items-center justify-between">
                                              <div>
                                                <span className="text-sm font-medium text-gray-900">{entry.description}</span>
                                                <p className="text-[11px] text-gray-400">by {entry.created_by_name}</p>
                                              </div>
                                              <span className="text-sm font-semibold text-teal-600">+{fmtKrw(entry.amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Exchange Out detail (on ChCh/QT) */}
                                    {exOutItems.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider mb-1.5">Exchange → KRW</p>
                                        <div className="space-y-1.5">
                                          {exOutItems.map(entry => (
                                            <div key={entry.id} className="bg-white rounded-lg border border-teal-100 p-2.5 flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900">{entry.description}</span>
                                                {entry.krw_amount && <span className="text-xs text-teal-500">→ ₩{parseInt(entry.krw_amount).toLocaleString()}</span>}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-teal-600">-{fmt(entry.amount)}</span>
                                                {entry.status === 'APPROVED' ? (
                                                  <span className="text-green-500"><CheckCircleIcon size={14} /></span>
                                                ) : (
                                                  <span className="text-[10px] text-amber-500 font-medium px-1.5 py-0.5 bg-amber-50 rounded">Pending</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Transfer In detail */}
                                    {tfInItems.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-1.5">Transfer In</p>
                                        <div className="space-y-1.5">
                                          {tfInItems.map(entry => (
                                            <div key={entry.id} className="bg-white rounded-lg border border-purple-100 p-2.5 flex items-center justify-between">
                                              <div>
                                                <span className="text-sm font-medium text-gray-900">{entry.description}</span>
                                                <p className="text-[11px] text-gray-400">by {entry.created_by_name}</p>
                                              </div>
                                              <span className="text-sm font-semibold text-purple-600">+{fmt(entry.amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Transfer Out detail */}
                                    {tfOutItems.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider mb-1.5">Transfer Out → {acctKey === 'CHCH' ? 'QT' : 'ChCh'}</p>
                                        <div className="space-y-1.5">
                                          {tfOutItems.map(entry => (
                                            <div key={entry.id} className="bg-white rounded-lg border border-purple-100 p-2.5 flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900">{entry.description}</span>
                                                {entry.attachment && <span className="text-xs text-blue-500">📎</span>}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-purple-600">-{fmt(entry.amount)}</span>
                                                {entry.status === 'APPROVED' ? (
                                                  <span className="text-green-500"><CheckCircleIcon size={14} /></span>
                                                ) : (
                                                  <span className="text-[10px] text-amber-500 font-medium px-1.5 py-0.5 bg-amber-50 rounded">Pending</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Expenses Out detail */}
                                    {expItems.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Expenses</p>
                                        <div className="space-y-1.5">
                                          {expItems.map(entry => (
                                            <div key={entry.id} className="bg-white rounded-lg border border-gray-100 p-2.5 flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900">{entry.description}</span>
                                                {entry.attachment && <span className="text-xs text-blue-500">📎</span>}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-red-600">-{tabFmt(entry.amount)}</span>
                                                {entry.status === 'APPROVED' ? (
                                                  <span className="text-green-500"><CheckCircleIcon size={14} /></span>
                                                ) : (
                                                  <span className="text-[10px] text-amber-500 font-medium px-1.5 py-0.5 bg-amber-50 rounded">Pending</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}

                      {/* Totals row */}
                      {(() => {
                        const tfNet = totalTfIn - totalTfOut
                        const totalAllIn = totalHrCash + totalTfIn + totalExIn
                        const totalAllOut = totalExpense + totalTfOut + totalExOut
                        const netBal = startBal + totalAllIn - totalAllOut
                        return (
                          <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                            <td className="px-3 py-3 text-gray-700">Total</td>
                            {isKrwTab ? (
                              <td className="px-3 py-3 text-right text-teal-600">{totalExIn > 0 ? `+${fmtKrw(totalExIn)}` : '—'}</td>
                            ) : (
                              <>
                                <td className="px-3 py-3 text-right text-green-600">{totalHrCash > 0 ? `+${fmt(totalHrCash)}` : '—'}</td>
                                <td className="px-3 py-3 text-right text-purple-600">
                                  {tfNet !== 0 || totalExOut > 0
                                    ? (totalExOut > 0 ? `-${fmt(totalExOut)}` : `${tfNet >= 0 ? '+' : '-'}${fmt(Math.abs(tfNet))}`)
                                    : '—'}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-3 text-amber-600">{totalExpense > 0 ? tabFmt(totalExpense) : '—'}</td>
                            <td className={`px-3 py-3 text-right font-bold ${netBal < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {tabFmt(netBal)}
                            </td>
                          </tr>
                        )
                      })()}
                    </tbody>
                  </table>

                  {/* Balance summary below table */}
                  {(() => {
                    const totalAllIn = totalHrCash + totalTfIn + totalExIn
                    const totalAllOut = totalExpense + totalTfOut + totalExOut
                    const netBal = startBal + totalAllIn - totalAllOut
                    return (
                      <div className="px-4 py-3 border-t border-gray-200 space-y-1">
                        <div className="flex justify-between text-xs text-gray-500"><span>Starting Balance</span><span>{tabFmt(startBal)}</span></div>
                        {isKrwTab ? (
                          totalExIn > 0 && <div className="flex justify-between text-xs text-teal-600"><span>+ Exchange In</span><span>+{fmtKrw(totalExIn)}</span></div>
                        ) : (
                          <>
                            {totalHrCash > 0 && <div className="flex justify-between text-xs text-green-600"><span>+ HR Cash</span><span>+{fmt(totalHrCash)}</span></div>}
                            {totalTfIn > 0 && <div className="flex justify-between text-xs text-purple-600"><span>+ Transfer In</span><span>+{fmt(totalTfIn)}</span></div>}
                            {totalTfOut > 0 && <div className="flex justify-between text-xs text-purple-500"><span>- Transfer Out</span><span>-{fmt(totalTfOut)}</span></div>}
                            {totalExOut > 0 && <div className="flex justify-between text-xs text-teal-600"><span>- Exchange</span><span>-{fmt(totalExOut)}</span></div>}
                          </>
                        )}
                        {totalExpense > 0 && <div className="flex justify-between text-xs text-red-500"><span>- Expenses</span><span>-{tabFmt(totalExpense)}</span></div>}
                        <div className="flex justify-between pt-1.5 border-t border-gray-100">
                          <span className="text-sm font-bold text-gray-900">Net Balance</span>
                          <span className={`text-sm font-bold ${netBal >= 0 ? 'text-green-600' : 'text-red-600'}`}>{tabFmt(netBal)}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
          </Card>
        </>
      )}
    </div>
  )
}

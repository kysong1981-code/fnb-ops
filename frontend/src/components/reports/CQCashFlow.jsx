import { useState, useEffect, useRef, Fragment } from 'react'
import { cqTransactionAPI } from '../../services/api'
import Card from '../ui/Card'
import { PlusIcon, TrashIcon } from '../icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const TX_TYPES = [
  { key: 'COLLECTION', label: 'Collection', color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'INCENTIVE', label: 'Incentive', color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'PROFIT', label: 'Profit Share', color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'EXPENSE', label: 'Expense', color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'TRANSFER', label: 'Transfer', color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'EXCHANGE', label: 'Exchange', color: 'text-teal-600', bg: 'bg-teal-50' },
  { key: 'BALANCE', label: 'Opening Balance', color: 'text-amber-600', bg: 'bg-amber-50' },
]

const ACCOUNT_TYPES = [
  { key: 'CASH', label: 'Cash' },
  { key: 'ACCOUNT', label: 'Account' },
  { key: 'KRW', label: 'KRW' },
]

const VIEWS = [
  { key: 'summary', label: 'Summary' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'history', label: 'History' },
  { key: 'stores', label: 'By Store' },
  { key: 'persons', label: 'By Person' },
  { key: 'all', label: 'All Transactions' },
  { key: 'import', label: 'CSV Import' },
]

const ACCOUNTS = ['QT', 'ChCh', 'KRW']

const CHART_COLORS = {
  collection: '#10b981',  // green
  collectionAccount: '#059669',
  collectionCash: '#6ee7b7',
  incentive: '#8b5cf6',   // purple
  equity: '#3b82f6',      // blue
}

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
}

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtKRW = (v) => `₩${parseFloat(v || 0).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Get H1/H2 date ranges: H1=Apr-Sep, H2=Oct-Mar
function getPeriodDates(year, period) {
  if (period === 'H1') {
    return { start: `${year}-04-01`, end: `${year}-09-30` }
  }
  // H2: Oct of year → Mar of next year
  return { start: `${year}-10-01`, end: `${year + 1}-03-31` }
}

function getCurrentPeriod() {
  const now = new Date()
  const m = now.getMonth() + 1
  if (m >= 4 && m <= 9) return { year: now.getFullYear(), period: 'H1' }
  if (m >= 10) return { year: now.getFullYear(), period: 'H2' }
  // Jan-Mar belongs to H2 of previous year
  return { year: now.getFullYear() - 1, period: 'H2' }
}

export default function CQCashFlow() {
  const [view, setView] = useState('summary')
  const currentP = getCurrentPeriod()
  const [year, setYear] = useState(currentP.year)
  const [period, setPeriod] = useState(currentP.period) // 'H1', 'H2', 'CUSTOM'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Custom date range
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Computed date range from year/period
  const dateRange = period === 'CUSTOM'
    ? { start: customStart || `${year}-04-01`, end: customEnd || `${year + 1}-03-31` }
    : getPeriodDates(year, period)

  // Data
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [storesList, setStoresList] = useState([])
  const [personsList, setPersonsList] = useState([])
  const [storeLedger, setStoreLedger] = useState(null)
  const [personalLedger, setPersonalLedger] = useState(null)
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedPerson, setSelectedPerson] = useState('')
  const [historyData, setHistoryData] = useState([])

  // New transaction form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    date: localDateStr(new Date()),
    store_name: '', transaction_type: 'COLLECTION',
    person: '', amount: '', account_type: 'CASH', note: '',
  })

  // Accounts
  const [selectedAccount, setSelectedAccount] = useState('QT')
  const [accountData, setAccountData] = useState(null)

  // Store lock status
  const [storeLockStatus, setStoreLockStatus] = useState({ is_locked: false, locked_by_name: '' })
  // Opening balance form
  const [showBalanceForm, setShowBalanceForm] = useState(false)
  const [balanceForm, setBalanceForm] = useState({ date: localDateStr(new Date()), amount: '' })

  // CSV import
  const [importFile, setImportFile] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  const inputCls = 'px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  useEffect(() => {
    if (period === 'CUSTOM' && (!customStart || !customEnd)) return
    loadData()
  }, [year, period, customStart, customEnd])

  useEffect(() => {
    if (view === 'stores' && selectedStore) loadStoreLedger()
    if (view === 'persons' && selectedPerson) loadPersonalLedger()
  }, [selectedStore, selectedPerson, year, period, customStart, customEnd])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { date_start: dateRange.start, date_end: dateRange.end }
      const [sumRes, storesRes, personsRes, histRes] = await Promise.all([
        cqTransactionAPI.summary(params),
        cqTransactionAPI.storesList(),
        cqTransactionAPI.personsList(),
        cqTransactionAPI.history(),
      ])
      setSummary(sumRes.data)
      setStoresList(storesRes.data.stores || [])
      setPersonsList(personsRes.data.persons || [])
      setHistoryData(histRes.data || [])
    } catch (e) {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadAllTransactions = async () => {
    try {
      const res = await cqTransactionAPI.list({ date_start: dateRange.start, date_end: dateRange.end })
      setTransactions(res.data.results || res.data || [])
    } catch (e) {
      setError('Failed to load transactions')
    }
  }

  const loadStoreLedger = async () => {
    if (!selectedStore) return
    try {
      const [res, lockRes] = await Promise.all([
        cqTransactionAPI.storeLedger({
          store_name: selectedStore, date_start: dateRange.start, date_end: dateRange.end,
        }),
        cqTransactionAPI.lockStatus({ store_name: selectedStore }),
      ])
      setStoreLedger(res.data)
      setStoreLockStatus(lockRes.data)
    } catch (e) {
      setError('Failed to load store ledger')
    }
  }

  const loadAccountStatement = async () => {
    if (!selectedAccount) return
    try {
      const res = await cqTransactionAPI.accountStatement({
        account: selectedAccount,
        date_start: dateRange.start,
        date_end: dateRange.end,
      })
      setAccountData(res.data)
    } catch (e) {
      setError('Failed to load account statement')
    }
  }

  useEffect(() => {
    if (view === 'accounts' && selectedAccount) loadAccountStatement()
  }, [view, selectedAccount, year, period, customStart, customEnd])

  const handleToggleLock = async () => {
    try {
      const periodLabel = period === 'H2'
        ? `${year}-Oct` : period === 'H1' ? `${year}-Apr` : ''
      await cqTransactionAPI.toggleLock({
        store_name: selectedStore,
        period: periodLabel || undefined,
      })
      loadStoreLedger()
      showMsg(storeLockStatus.is_locked ? 'Unlocked' : 'Locked')
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to toggle lock')
    }
  }

  const handleAddBalance = async () => {
    if (!balanceForm.amount || !selectedStore) return
    try {
      await cqTransactionAPI.create({
        date: balanceForm.date,
        store_name: selectedStore,
        transaction_type: 'BALANCE',
        person: 'Opening Balance',
        amount: balanceForm.amount,
        account_type: 'CASH',
        note: 'Opening Balance',
      })
      setBalanceForm({ date: localDateStr(new Date()), amount: '' })
      setShowBalanceForm(false)
      loadStoreLedger()
      loadData()
      showMsg('Opening balance added')
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to add balance')
    }
  }

  const loadPersonalLedger = async () => {
    if (!selectedPerson) return
    try {
      const res = await cqTransactionAPI.personalLedger({
        person: selectedPerson, date_start: dateRange.start, date_end: dateRange.end,
      })
      setPersonalLedger(res.data)
    } catch (e) {
      setError('Failed to load personal ledger')
    }
  }

  const loadHistory = async () => {
    try {
      const res = await cqTransactionAPI.history()
      setHistoryData(res.data || [])
    } catch (e) {
      setError('Failed to load history')
    }
  }

  const handleCreate = async () => {
    if (!form.amount || !form.date) return
    try {
      await cqTransactionAPI.create({
        ...form,
        amount: parseFloat(form.amount),
      })
      showMsg('Transaction created')
      setForm({ date: localDateStr(new Date()), store_name: '', transaction_type: 'COLLECTION', person: '', amount: '', account_type: 'CASH', note: '' })
      setShowForm(false)
      loadData()
      if (view === 'all') loadAllTransactions()
    } catch (e) {
      setError('Failed to create transaction')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return
    try {
      await cqTransactionAPI.delete(id)
      showMsg('Deleted')
      loadData()
      if (view === 'all') loadAllTransactions()
      if (view === 'stores') loadStoreLedger()
      if (view === 'persons') loadPersonalLedger()
    } catch (e) {
      setError('Delete failed')
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    const formData = new FormData()
    formData.append('file', importFile)
    try {
      setLoading(true)
      const res = await cqTransactionAPI.importCSV(formData)
      setImportResult(res.data)
      if (res.data.created_count > 0) {
        showMsg(`${res.data.created_count} transactions imported`)
        loadData()
      }
    } catch (e) {
      setError('CSV import failed')
    } finally {
      setLoading(false)
      setImportFile(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleExport = async () => {
    try {
      const res = await cqTransactionAPI.exportCSV({ date_start: dateRange.start, date_end: dateRange.end })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `cq_transactions_${dateRange.start}_${dateRange.end}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError('CSV export failed')
    }
  }

  const getTxType = (key) => TX_TYPES.find(t => t.key === key) || TX_TYPES[0]

  const periodLabel = period === 'CUSTOM'
    ? `${customStart || '?'} ~ ${customEnd || '?'}`
    : period === 'H1'
      ? `H1 (Apr - Sep ${year})`
      : `H2 (Oct ${year} - Mar ${year + 1})`

  // ============ RENDER ============

  return (
    <div className="space-y-4">
      {/* Header: Year/Period selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800">💰 Cash Flow</h2>
          {/* Year */}
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="text-lg font-bold text-gray-900 min-w-[3.5rem] text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          {/* Period toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {[
              { key: 'H1', label: 'H1' },
              { key: 'H2', label: 'H2' },
              { key: 'CUSTOM', label: 'Custom' },
            ].map(p => (
              <button key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === p.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-1">
          <PlusIcon className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Custom date range picker */}
      {period === 'CUSTOM' && (
        <div className="flex items-center gap-2">
          <input type="date" value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400 text-sm">~</span>
          <input type="date" value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}

      {/* Period label */}
      {period !== 'CUSTOM' && <div className="text-sm text-gray-500">{periodLabel}</div>}

      {/* Messages */}
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}
      {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm">{success}</div>}

      {/* View Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {VIEWS.map(v => (
          <button key={v.key}
            onClick={() => {
              setView(v.key)
              if (v.key === 'all') loadAllTransactions()
              if (v.key === 'history') loadHistory()
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              view === v.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* New Transaction Form */}
      {showForm && (
        <Card>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Add Transaction</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                className={inputCls} />
              <select value={form.transaction_type} onChange={e => setForm({...form, transaction_type: e.target.value})}
                className={inputCls}>
                {TX_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <select value={form.account_type} onChange={e => setForm({...form, account_type: e.target.value})}
                className={inputCls}>
                {ACCOUNT_TYPES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
              <input placeholder="Store name" value={form.store_name} onChange={e => setForm({...form, store_name: e.target.value})}
                className={inputCls} list="store-suggestions" />
              <datalist id="store-suggestions">
                {storesList.map(s => <option key={s} value={s} />)}
              </datalist>
              <input placeholder="Person" value={form.person} onChange={e => setForm({...form, person: e.target.value})}
                className={inputCls} list="person-suggestions" />
              <datalist id="person-suggestions">
                {personsList.map(p => <option key={p} value={p} />)}
              </datalist>
              <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                className={inputCls} />
            </div>
            <input placeholder="Note" value={form.note} onChange={e => setForm({...form, note: e.target.value})}
              className={inputCls + ' w-full'} />
            <button onClick={handleCreate}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              Save
            </button>
          </div>
        </Card>
      )}

      {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}

      {/* ===== SUMMARY VIEW ===== */}
      {view === 'summary' && summary && !loading && (
        <div className="space-y-4">
          {/* Owner Profit by Quarter Chart */}
          {historyData.length > 0 && (
            <Card>
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Owner Profit by Quarter</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={historyData
                    .filter(h => (h.owner_profit || 0) > 0)
                    .map(h => {
                      // period label: "2024-Oct" = H1 of 2024, "2025-Apr" = H2 of 2024
                      const [yr, mon] = h.period.split('-')
                      let label = h.period
                      if (mon === 'Oct') label = `${yr} H1`
                      else if (mon === 'Apr') label = `${parseInt(yr)-1} H2`
                      return { period: label, owner_profit: h.owner_profit || 0 }
                    })}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v) => [fmt(v), 'Owner Profit']}
                      contentStyle={tooltipStyle} />
                    <Bar dataKey="owner_profit" fill="#10b981" radius={[6, 6, 0, 0]} name="Owner Profit" />
                  </BarChart>
                </ResponsiveContainer>
                {/* Grand total */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Total Owner Profit (All Time)</span>
                  <span className="text-lg font-bold text-green-600">
                    {fmt(historyData.reduce((s, h) => s + (h.owner_profit || 0), 0))}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Store Overview - Owner Profit Only */}
          {summary.stores?.length > 0 && (
            <Card>
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Store Overview</h3>
                <div className="space-y-2">
                  {summary.stores
                    .filter(s => parseFloat(s.owner_profit) > 0)
                    .sort((a, b) => parseFloat(b.owner_profit) - parseFloat(a.owner_profit))
                    .map(s => {
                      const maxProfit = Math.max(...summary.stores.map(x => parseFloat(x.owner_profit) || 0))
                      const pct = maxProfit > 0 ? (parseFloat(s.owner_profit) / maxProfit) * 100 : 0
                      return (
                        <div key={s.store_name}
                          className="cursor-pointer hover:bg-gray-50 rounded-xl p-3 transition"
                          onClick={() => { setSelectedStore(s.store_name); setView('stores') }}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-gray-800">{s.store_name}</span>
                            <span className="text-sm font-bold text-green-600">{fmt(s.owner_profit)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  {/* Total */}
                  <div className="pt-3 mt-1 border-t-2 border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-green-600 text-lg">
                      {fmt(summary.stores.reduce((s, r) => s + (parseFloat(r.owner_profit) || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Partner Distribution */}
          {summary.persons?.length > 0 && (() => {
            const partners = summary.persons.filter(p =>
              p.person !== 'Owner' && p.person !== 'Deposit' && p.person !== 'Opening Balance'
              && p.person !== 'QT' && p.person !== 'ChCh'
              && ((parseFloat(p.by_type?.incentive) || 0) + (parseFloat(p.by_type?.profit) || 0) > 0)
            )
            return partners.length > 0 && (
            <Card>
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Partner Distribution</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4 text-right">Incentive</th>
                        <th className="pb-2 pr-4 text-right">Equity Share</th>
                        <th className="pb-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.map(p => (
                        <tr key={p.person} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                          onClick={() => { setSelectedPerson(p.person); setView('persons') }}>
                          <td className="py-2.5 pr-4 font-medium text-gray-800">{p.person}</td>
                          <td className="py-2.5 pr-4 text-right text-purple-600">{fmt(p.by_type?.incentive)}</td>
                          <td className="py-2.5 pr-4 text-right text-blue-600">{fmt(p.by_type?.profit)}</td>
                          <td className="py-2.5 text-right font-semibold text-gray-800">{fmt((parseFloat(p.by_type?.incentive) || 0) + (parseFloat(p.by_type?.profit) || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
            )
          })()}

          {!summary.stores?.length && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div>No transactions for this period</div>
              <div className="text-xs mt-1">Add transactions manually or import via CSV</div>
            </div>
          )}
        </div>
      )}

      {/* ===== HISTORY VIEW ===== */}
      {view === 'history' && (
        <div className="space-y-4">
          {historyData.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No history data yet</div>
          ) : (
            <>
              {/* Total Trend Chart */}
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">📊 Period Comparison</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={historyData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="collection" name="Owner Profit" fill={CHART_COLORS.collection} radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="incentive" name="Incentive" fill={CHART_COLORS.incentive} radius={[0, 0, 0, 0]} stackId="a" />
                      <Bar dataKey="equity" name="Equity Share" fill={CHART_COLORS.equity} radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Owner Account vs Cash Trend */}
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">💰 Owner Profit: Account vs Cash</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={historyData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="collection_account" name="Account" fill={CHART_COLORS.collectionAccount} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="collection_cash" name="Cash" fill={CHART_COLORS.collectionCash} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* History Table */}
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">📋 Period Detail</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-3">Period</th>
                          <th className="pb-2 pr-3 text-right">Owner Profit</th>
                          <th className="pb-2 pr-3 text-right">Account</th>
                          <th className="pb-2 pr-3 text-right">Cash</th>
                          <th className="pb-2 pr-3 text-right">Incentive</th>
                          <th className="pb-2 pr-3 text-right">Equity</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map(h => (
                          <tr key={h.period} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2.5 pr-3 font-medium text-gray-800">{h.period}</td>
                            <td className="py-2.5 pr-3 text-right text-green-600 font-medium">{fmt(h.collection)}</td>
                            <td className="py-2.5 pr-3 text-right text-emerald-700 text-xs">{fmt(h.collection_account)}</td>
                            <td className="py-2.5 pr-3 text-right text-emerald-500 text-xs">{fmt(h.collection_cash)}</td>
                            <td className="py-2.5 pr-3 text-right text-purple-600">{fmt(h.incentive)}</td>
                            <td className="py-2.5 pr-3 text-right text-blue-600">{fmt(h.equity)}</td>
                            <td className="py-2.5 text-right font-semibold text-gray-800">{fmt(h.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>

              {/* Per-Store History (if multiple stores in data) */}
              {(() => {
                const allStores = [...new Set(historyData.flatMap(h => (h.stores || []).map(s => s.store_name)))]
                if (allStores.length <= 1) return null
                return allStores.map(storeName => {
                  const storeHistory = historyData.map(h => {
                    const s = h.stores?.find(s => s.store_name === storeName) || {}
                    return { period: h.period, collection: s.collection || 0, incentive: s.incentive || 0, equity: s.equity || 0, total: s.total || 0 }
                  }).filter(d => d.total > 0)
                  if (storeHistory.length === 0) return null
                  return (
                    <Card key={storeName}>
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-800 mb-4">🏪 {storeName}</h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={storeHistory} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                            <Bar dataKey="collection" name="Owner" fill={CHART_COLORS.collection} radius={[4, 4, 0, 0]} stackId="a" />
                            <Bar dataKey="incentive" name="Incentive" fill={CHART_COLORS.incentive} stackId="a" />
                            <Bar dataKey="equity" name="Equity" fill={CHART_COLORS.equity} radius={[4, 4, 0, 0]} stackId="a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  )
                })
              })()}
            </>
          )}
        </div>
      )}

      {/* ===== ACCOUNTS VIEW ===== */}
      {view === 'accounts' && (
        <div className="space-y-4">
          {/* Account selector */}
          <div className="flex gap-2">
            {ACCOUNTS.map(acc => (
              <button key={acc} onClick={() => setSelectedAccount(acc)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition ${
                  selectedAccount === acc
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {acc}
              </button>
            ))}
          </div>

          {accountData && (() => {
            const f = selectedAccount === 'KRW' ? fmtKRW : fmt
            return (
            <>
              {/* Balance Cards */}
              <Card>
                <div className="p-5">
                  <div className="text-center mb-3">
                    <div className="text-xs text-gray-500 mb-1">{selectedAccount} Current Balance</div>
                    <div className={`text-3xl font-bold ${accountData.total_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {f(accountData.total_balance)}
                    </div>
                  </div>
                  {accountData.opening_balance != null && accountData.opening_balance !== 0 && (
                    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-500">이월 잔액</span>
                      <span className={`text-sm font-semibold ${accountData.opening_balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {f(accountData.opening_balance)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs text-gray-400">{accountData.transaction_count} transactions this period</span>
                  </div>
                </div>
              </Card>

              {/* Per-store breakdown (hide for KRW) */}
              {selectedAccount !== 'KRW' && accountData.store_summary?.length > 0 && (
                <Card>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">By Store</h3>
                    <div className="space-y-2">
                      {accountData.store_summary.map(s => (
                        <div key={s.store_name} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                          <span className="text-sm font-medium text-gray-700">{s.store_name}</span>
                          <span className="text-sm font-bold text-green-600">{f(s.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Monthly summary (hide for KRW) */}
              {selectedAccount !== 'KRW' && accountData.monthly_summary?.length > 0 && (
                <Card>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Monthly Summary</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 pr-3">Month</th>
                            {accountData.store_summary?.map(s => (
                              <th key={s.store_name} className="pb-2 pr-3 text-right">{s.store_name}</th>
                            ))}
                            <th className="pb-2 text-right font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.monthly_summary.map(m => {
                            const storeMap = Object.fromEntries(m.stores.map(s => [s.store_name, s.amount]))
                            return (
                              <tr key={m.month} className="border-b border-gray-50">
                                <td className="py-2 pr-3 text-gray-600">
                                  {new Date(m.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                                </td>
                                {accountData.store_summary?.map(s => (
                                  <td key={s.store_name} className="py-2 pr-3 text-right text-gray-700">
                                    {storeMap[s.store_name] ? f(storeMap[s.store_name]) : '-'}
                                  </td>
                                ))}
                                <td className="py-2 text-right font-semibold text-gray-900">{f(m.total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              )}

              {/* Ledger (statement) */}
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Statement</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-3">Date</th>
                          <th className="pb-2 pr-3">Store</th>
                          <th className="pb-2 pr-3">Note</th>
                          <th className="pb-2 pr-3 text-right">Amount</th>
                          <th className="pb-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountData.ledger?.map(item => (
                          <tr key={item.id} className="border-b border-gray-50">
                            <td className="py-2 pr-3 text-gray-600">{item.date}</td>
                            <td className="py-2 pr-3 text-gray-800">{item.store_name}</td>
                            <td className="py-2 pr-3 text-gray-500 text-xs">{item.note}</td>
                            <td className={`py-2 pr-3 text-right font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {item.amount >= 0 ? '+' : ''}{f(item.amount)}
                            </td>
                            <td className="py-2 text-right font-medium text-gray-800">{f(item.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </>
          )})()}

          {!accountData && (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          )}
        </div>
      )}

      {/* ===== STORE VIEW ===== */}
      {view === 'stores' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
              className={inputCls + ' flex-1'}>
              <option value="">Select store...</option>
              {storesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {selectedStore && (
              <button onClick={handleToggleLock}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  storeLockStatus.is_locked
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}>
                {storeLockStatus.is_locked ? 'Unlock' : 'Lock'}
              </button>
            )}
          </div>

          {/* Lock status badge */}
          {storeLockStatus.is_locked && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-amber-600 text-sm font-medium">
                Locked by {storeLockStatus.locked_by_name}
              </span>
            </div>
          )}

          {/* Opening Balance */}
          {selectedStore && !storeLockStatus.is_locked && (
            <div>
              {!showBalanceForm ? (
                <button onClick={() => setShowBalanceForm(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  + Add Opening Balance
                </button>
              ) : (
                <Card>
                  <div className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800">Opening Balance</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Date</label>
                        <input type="date" value={balanceForm.date}
                          onChange={e => setBalanceForm(p => ({ ...p, date: e.target.value }))}
                          className={inputCls + ' w-full'} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Amount ($)</label>
                        <input type="number" step="0.01" value={balanceForm.amount}
                          onChange={e => setBalanceForm(p => ({ ...p, amount: e.target.value }))}
                          placeholder="0.00" className={inputCls + ' w-full'} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddBalance}
                        disabled={!balanceForm.amount}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                        Save
                      </button>
                      <button onClick={() => setShowBalanceForm(false)}
                        className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl font-semibold hover:bg-gray-200 transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {storeLedger && selectedStore && (
            <>
              {/* Owner Account/Cash + Summary */}
              {(() => {
                const ownerItems = storeLedger.ledger?.filter(i => i.transaction_type === 'COLLECTION') || []
                const ownerAccount = ownerItems.filter(i => i.account_type === 'ACCOUNT').reduce((s, i) => s + i.income, 0)
                const ownerCash = ownerItems.filter(i => i.account_type === 'CASH').reduce((s, i) => s + i.income, 0)
                const incentiveTotal = storeLedger.ledger?.filter(i => i.transaction_type === 'INCENTIVE').reduce((s, i) => s + i.expense, 0) || 0
                const equityTotal = storeLedger.ledger?.filter(i => i.transaction_type === 'PROFIT').reduce((s, i) => s + i.expense, 0) || 0
                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                      <div className="text-xs text-gray-500 mb-1">Owner Profit</div>
                      <div className="text-lg font-bold text-green-600">{fmt(storeLedger.total_collection)}</div>
                      {(ownerAccount > 0 || ownerCash > 0) && (
                        <div className="mt-2 pt-2 border-t border-green-200 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Account</span>
                            <span className="font-medium text-green-700">{fmt(ownerAccount)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Cash</span>
                            <span className="font-medium text-green-700">{fmt(ownerCash)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
                      <div className="text-xs text-gray-500 mb-1">Incentive</div>
                      <div className="text-lg font-bold text-purple-600">{fmt(incentiveTotal)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                      <div className="text-xs text-gray-500 mb-1">Equity Share</div>
                      <div className="text-lg font-bold text-blue-600">{fmt(equityTotal)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Net Profit</div>
                      <div className="text-lg font-bold text-gray-800">
                        {fmt(storeLedger.total_collection + (storeLedger.total_distributed || 0))}
                      </div>
                    </div>
                  </div>
                )
              })()}
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">{selectedStore} Ledger</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-3">Date</th>
                          <th className="pb-2 pr-3">Type</th>
                          <th className="pb-2 pr-3">Person</th>
                          <th className="pb-2 pr-3 text-right">In</th>
                          <th className="pb-2 pr-3 text-right">Out</th>
                          <th className="pb-2 text-right">Balance</th>
                          <th className="pb-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeLedger.ledger?.map(item => {
                          const txType = getTxType(item.transaction_type)
                          return (
                            <tr key={item.id} className="border-b border-gray-50">
                              <td className="py-2 pr-3 text-gray-600">{item.date}</td>
                              <td className="py-2 pr-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${txType.bg} ${txType.color}`}>
                                  {txType.label}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-gray-800">{item.person}</td>
                              <td className="py-2 pr-3 text-right text-green-600">
                                {item.income > 0 ? fmt(item.income) : ''}
                              </td>
                              <td className="py-2 pr-3 text-right text-red-600">
                                {item.expense > 0 ? fmt(item.expense) : ''}
                              </td>
                              <td className="py-2 text-right font-medium text-gray-800">{fmt(item.balance)}</td>
                              <td className="py-2 pl-2">
                                {!storeLockStatus.is_locked && !item.is_locked ? (
                                  <button onClick={() => handleDelete(item.id)}
                                    className="text-gray-300 hover:text-red-500">
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="text-gray-300 text-xs">🔒</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </>
          )}
          {!selectedStore && (
            <div className="text-center py-12 text-gray-400">Select a store to view ledger</div>
          )}
        </div>
      )}

      {/* ===== PERSON VIEW ===== */}
      {view === 'persons' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)}
              className={inputCls + ' flex-1'}>
              <option value="">Select person...</option>
              {personsList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {personalLedger && selectedPerson && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">Total Received</div>
                  <div className="text-lg font-bold text-green-600">{fmt(personalLedger.total_income)}</div>
                </div>
                <div className="bg-red-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">Total Expense</div>
                  <div className="text-lg font-bold text-red-600">{fmt(personalLedger.total_expense)}</div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">Balance</div>
                  <div className={`text-lg font-bold ${personalLedger.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(personalLedger.balance)}
                  </div>
                </div>
              </div>
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">👤 {selectedPerson} Ledger</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-3">Date</th>
                          <th className="pb-2 pr-3">Store</th>
                          <th className="pb-2 pr-3">Type</th>
                          <th className="pb-2 pr-3 text-right">In</th>
                          <th className="pb-2 pr-3 text-right">Out</th>
                          <th className="pb-2 pr-3">Note</th>
                          <th className="pb-2 text-right">Balance</th>
                          <th className="pb-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {personalLedger.ledger?.map(item => {
                          const txType = getTxType(item.transaction_type)
                          return (
                            <tr key={item.id} className="border-b border-gray-50">
                              <td className="py-2 pr-3 text-gray-600">{item.date}</td>
                              <td className="py-2 pr-3 text-gray-800">{item.store_name}</td>
                              <td className="py-2 pr-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${txType.bg} ${txType.color}`}>
                                  {txType.label}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-right text-green-600">
                                {item.income > 0 ? fmt(item.income) : ''}
                              </td>
                              <td className="py-2 pr-3 text-right text-red-600">
                                {item.expense > 0 ? fmt(item.expense) : ''}
                              </td>
                              <td className="py-2 pr-3 text-gray-500 text-xs max-w-[120px] truncate">{item.note}</td>
                              <td className="py-2 text-right font-medium text-gray-800">{fmt(item.balance)}</td>
                              <td className="py-2 pl-2">
                                <button onClick={() => handleDelete(item.id)}
                                  className="text-gray-300 hover:text-red-500">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </>
          )}
          {!selectedPerson && (
            <div className="text-center py-12 text-gray-400">Select a person to view ledger</div>
          )}
        </div>
      )}

      {/* ===== ALL TRANSACTIONS VIEW ===== */}
      {view === 'all' && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">All Transactions</h3>
              <button onClick={handleExport}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200">
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Store</th>
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Person</th>
                    <th className="pb-2 pr-3 text-right">Amount</th>
                    <th className="pb-2 pr-3">Account</th>
                    <th className="pb-2 pr-3">Note</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const txType = getTxType(tx.transaction_type)
                    return (
                      <tr key={tx.id} className="border-b border-gray-50">
                        <td className="py-2 pr-3 text-gray-600">{tx.date}</td>
                        <td className="py-2 pr-3 text-gray-800">{tx.store_name}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${txType.bg} ${txType.color}`}>
                            {txType.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-gray-800">{tx.person}</td>
                        <td className="py-2 pr-3 text-right font-medium">
                          {fmt(tx.amount)}
                        </td>
                        <td className="py-2 pr-3 text-gray-500 text-xs">{tx.account_type}</td>
                        <td className="py-2 pr-3 text-gray-500 text-xs max-w-[150px] truncate">{tx.note}</td>
                        <td className="py-2 pl-2">
                          <button onClick={() => handleDelete(tx.id)}
                            className="text-gray-300 hover:text-red-500">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">No transactions</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* ===== CSV IMPORT VIEW ===== */}
      {view === 'import' && (
        <div className="space-y-4">
          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-gray-800">📥 CSV Import</h3>
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                <div className="font-medium mb-2">CSV Format (column names required):</div>
                <code className="block bg-white p-3 rounded-lg text-xs overflow-x-auto whitespace-pre">
{`date,store,type,person,amount,account_type,note,period,incentive_rate
2026-01-01,Q Airport,COLLECTION,,18200,CASH,Monthly collection,,
2026-03-31,Q Airport,INCENTIVE,jongjin,7885,CASH,Incentive,2025-Oct,0.1
2026-03-31,Q Airport,PROFIT,sky,49675,CASH,Profit share,2025-Oct,
2026-03-31,,EXPENSE,yong,80000,CASH,Owner expense,,`}
                </code>
                <div className="mt-3 text-xs space-y-1">
                  <div><strong>type:</strong> COLLECTION, INCENTIVE, PROFIT, EXPENSE, TRANSFER, EXCHANGE</div>
                  <div><strong>account_type:</strong> CASH, ACCOUNT, KRW (default: CASH)</div>
                  <div><strong>period:</strong> Semi-annual label (optional, e.g. 2025-Oct)</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="file" accept=".csv" ref={fileRef}
                  onChange={e => setImportFile(e.target.files[0])}
                  className={inputCls + ' flex-1'} />
                <button onClick={handleImport} disabled={!importFile || loading}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Processing...' : 'Import'}
                </button>
              </div>

              {importResult && (
                <div className={`rounded-xl p-4 ${importResult.created_count > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="font-medium text-sm">
                    ✅ {importResult.created_count} imported
                    {importResult.error_count > 0 && (
                      <span className="text-red-600 ml-2">❌ {importResult.error_count} failed</span>
                    )}
                  </div>
                  {importResult.errors?.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 space-y-1">
                      {importResult.errors.map((err, i) => <div key={i}>{err}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Template Download */}
          <Card>
            <div className="p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">📋 Quick Templates</h3>
              <p className="text-sm text-gray-500">
                Quickly input monthly collection data per store.
                Save as CSV from Excel then upload.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => {
                  const template = 'date,store,type,person,amount,account_type,note,period,incentive_rate\n'
                    + storesList.map(s => `${localDateStr(new Date())},${s},COLLECTION,,0,CASH,Monthly collection,,`).join('\n')
                  const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = 'collection_template.csv'
                  a.click()
                }}
                  className="px-4 py-3 bg-green-50 text-green-700 rounded-xl text-sm hover:bg-green-100 text-left">
                  <div className="font-medium">📥 Collection Template</div>
                  <div className="text-xs text-green-500 mt-1">{storesList.length} stores included</div>
                </button>
                <button onClick={handleExport}
                  className="px-4 py-3 bg-gray-50 text-gray-700 rounded-xl text-sm hover:bg-gray-100 text-left">
                  <div className="font-medium">📤 Export Current Data</div>
                  <div className="text-xs text-gray-500 mt-1">Backup or edit & re-upload</div>
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

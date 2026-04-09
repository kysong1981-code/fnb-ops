import { useState, useEffect } from 'react'
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
  { key: 'quarter', label: 'Quarter Report' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'stores', label: 'By Store' },
  { key: 'persons', label: 'By Person' },
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

  // Accounts - own period state
  const [selectedAccount, setSelectedAccount] = useState('QT')
  const [accountData, setAccountData] = useState(null)
  const [acctYear, setAcctYear] = useState(currentP.year)
  const [acctMode, setAcctMode] = useState('YEAR') // 'YEAR' or 'CUSTOM'
  const [acctStart, setAcctStart] = useState('')
  const [acctEnd, setAcctEnd] = useState('')

  // Computed account date range: YEAR = full fiscal year (Jan 1 - Dec 31)
  const acctDateRange = acctMode === 'CUSTOM'
    ? { start: acctStart || `${acctYear}-01-01`, end: acctEnd || `${acctYear}-12-31` }
    : { start: `${acctYear}-01-01`, end: `${acctYear}-12-31` }

  // Store lock status
  const [storeLockStatus, setStoreLockStatus] = useState({ is_locked: false, locked_by_name: '' })
  // Opening balance form
  const [showBalanceForm, setShowBalanceForm] = useState(false)
  const [balanceForm, setBalanceForm] = useState({ date: localDateStr(new Date()), amount: '' })


  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  const inputCls = 'px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  // Load history on mount (for Summary - all time)
  useEffect(() => {
    loadHistoryData()
  }, [])

  // Load period data when period changes (for Quarter Report, Accounts, etc.)
  useEffect(() => {
    if (period === 'CUSTOM' && (!customStart || !customEnd)) return
    loadPeriodData()
  }, [year, period, customStart, customEnd])

  useEffect(() => {
    if (view === 'stores' && selectedStore) loadStoreLedger()
    if (view === 'persons' && selectedPerson) loadPersonalLedger()
  }, [selectedStore, selectedPerson, year, period, customStart, customEnd])

  const loadHistoryData = async () => {
    try {
      const [histRes, storesRes, personsRes] = await Promise.all([
        cqTransactionAPI.history(),
        cqTransactionAPI.storesList(),
        cqTransactionAPI.personsList(),
      ])
      setHistoryData(histRes.data || [])
      setStoresList(storesRes.data.stores || [])
      setPersonsList(personsRes.data.persons || [])
    } catch (e) {
      setError('Failed to load data')
    }
  }

  const loadPeriodData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { date_start: dateRange.start, date_end: dateRange.end }
      const res = await cqTransactionAPI.summary(params)
      setSummary(res.data)
    } catch (e) {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Alias for backward compat in create/delete handlers
  const loadData = () => { loadPeriodData(); loadHistoryData() }

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
        date_start: acctDateRange.start,
        date_end: acctDateRange.end,
      })
      setAccountData(res.data)
    } catch (e) {
      setError('Failed to load account statement')
    }
  }

  useEffect(() => {
    if (view === 'accounts' && selectedAccount) {
      if (acctMode === 'CUSTOM' && (!acctStart || !acctEnd)) return
      loadAccountStatement()
    }
  }, [view, selectedAccount, acctYear, acctMode, acctStart, acctEnd])

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
      if (view === 'stores') loadStoreLedger()
      if (view === 'persons') loadPersonalLedger()
    } catch (e) {
      setError('Delete failed')
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
      {/* Header */}
      <h2 className="text-lg font-bold text-gray-800">📊 CQ Report</h2>

      {/* Messages */}
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}
      {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm">{success}</div>}

      {/* View Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {VIEWS.map(v => (
          <button key={v.key}
            onClick={() => setView(v.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              view === v.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}

      {/* ===== SUMMARY VIEW ===== */}
      {view === 'summary' && !loading && (
        <div className="space-y-4">
          {historyData.length > 0 ? (() => {
            // Build chart data
            const chartData = historyData
              .filter(h => (h.owner_profit || 0) > 0)
              .map(h => {
                const [yr, mon] = h.period.split('-')
                let label = h.period
                if (mon === 'Oct') label = `${yr} H1`
                else if (mon === 'Apr') label = `${parseInt(yr)-1} H2`
                return {
                  period: label,
                  owner_profit: h.owner_profit || 0,
                  owner_account: h.owner_account || 0,
                  owner_cash: h.owner_cash || 0,
                }
              })
            // Build store ranking from all periods
            const storeMap = {}
            historyData.forEach(h => {
              (h.stores || []).forEach(s => {
                if (!storeMap[s.store_name]) storeMap[s.store_name] = { owner_profit: 0, owner_account: 0, owner_cash: 0 }
                storeMap[s.store_name].owner_profit += s.owner_profit || s.collection || 0
                storeMap[s.store_name].owner_account += s.owner_account || s.collection_account || 0
                storeMap[s.store_name].owner_cash += s.owner_cash || s.collection_cash || 0
              })
            })
            const ranked = Object.entries(storeMap)
              .filter(([, v]) => v.owner_profit > 0)
              .sort((a, b) => b[1].owner_profit - a[1].owner_profit)
            const grandTotal = historyData.reduce((s, h) => s + (h.owner_profit || 0), 0)
            const maxProfit = ranked.length > 0 ? ranked[0][1].owner_profit : 0

            return (
              <>
                {/* Owner Profit by Quarter Chart */}
                <Card>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Owner Profit by Quarter</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const d = payload[0].payload
                            return (
                              <div style={{ ...tooltipStyle, padding: '10px 14px', background: '#fff' }}>
                                <div className="text-xs font-bold text-gray-800 mb-2">{d.period}</div>
                                <div className="flex justify-between gap-6 text-xs">
                                  <span className="text-gray-500">Total</span>
                                  <span className="font-bold text-green-600">{fmt(d.owner_profit)}</span>
                                </div>
                                <div className="flex justify-between gap-6 text-xs mt-1">
                                  <span className="text-gray-500">Account</span>
                                  <span className="font-medium text-gray-700">{fmt(d.owner_account)}</span>
                                </div>
                                <div className="flex justify-between gap-6 text-xs mt-1">
                                  <span className="text-gray-500">Cash</span>
                                  <span className="font-medium text-orange-600">{fmt(d.owner_cash)}</span>
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="owner_profit" fill="#10b981" radius={[6, 6, 0, 0]} name="Owner Profit" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-sm text-gray-500">Total Owner Profit</span>
                      <span className="text-lg font-bold text-green-600">{fmt(grandTotal)}</span>
                    </div>
                  </div>
                </Card>

                {/* Store Ranking */}
                {ranked.length > 0 && (
                  <Card>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-800 mb-3">Store Ranking</h3>
                      <div className="space-y-2">
                        {ranked.map(([name, data], idx) => {
                          const pct = maxProfit > 0 ? (data.owner_profit / maxProfit) * 100 : 0
                          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
                          return (
                            <div key={name}
                              className="cursor-pointer hover:bg-gray-50 rounded-xl p-3 transition"
                              onClick={() => { setSelectedStore(name); setView('stores') }}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-gray-800">
                                  <span className="mr-2">{medal}</span>{name}
                                </span>
                                <span className="text-sm font-bold text-green-600">{fmt(data.owner_profit)}</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex gap-4 mt-1 text-xs text-gray-400">
                                <span>Account: {fmt(data.owner_account)}</span>
                                <span>Cash: {fmt(data.owner_cash)}</span>
                              </div>
                            </div>
                          )
                        })}
                        <div className="pt-3 mt-1 border-t-2 border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-gray-900">Total</span>
                          <span className="font-bold text-green-600 text-lg">{fmt(grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )
          })() : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div>No data yet</div>
            </div>
          )}
        </div>
      )}

      {/* ===== QUARTER REPORT VIEW ===== */}
      {view === 'quarter' && (
        <div className="space-y-4">
          {/* Period Selector */}
          <div className="flex flex-wrap items-center gap-3">
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
            {period === 'CUSTOM' ? (
              <div className="flex items-center gap-2">
                <input type="date" value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-gray-400 text-sm">~</span>
                <input type="date" value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ) : (
              <span className="text-sm text-gray-500">{periodLabel}</span>
            )}
          </div>

          {summary ? (() => {
            // Per-store data for this period
            const stores = (summary.stores || [])
              .filter(s => parseFloat(s.owner_profit) > 0)
              .sort((a, b) => parseFloat(b.owner_profit) - parseFloat(a.owner_profit))
            const grandTotal = stores.reduce((s, r) => s + (parseFloat(r.owner_profit) || 0), 0)
            const maxP = stores.length > 0 ? parseFloat(stores[0].owner_profit) : 0
            const totalIncentive = stores.reduce((s, r) => s + (parseFloat(r.incentive) || 0), 0)
            const totalEquity = stores.reduce((s, r) => s + (parseFloat(r.equity) || 0), 0)

            return stores.length > 0 ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                    <div className="text-xs text-gray-500 mb-1">Owner Profit</div>
                    <div className="text-xl font-bold text-green-600">{fmt(grandTotal)}</div>
                  </div>
                  <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
                    <div className="text-xs text-gray-500 mb-1">Incentive</div>
                    <div className="text-xl font-bold text-purple-600">{fmt(totalIncentive)}</div>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                    <div className="text-xs text-gray-500 mb-1">Equity Share</div>
                    <div className="text-xl font-bold text-blue-600">{fmt(totalEquity)}</div>
                  </div>
                </div>

                {/* Store Ranking for Period */}
                <Card>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Store Breakdown</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 pr-3">#</th>
                            <th className="pb-2 pr-3">Store</th>
                            <th className="pb-2 pr-3 text-right">Cash</th>
                            <th className="pb-2 pr-3 text-right">Account</th>
                            <th className="pb-2 pr-3 text-right">Owner Profit</th>
                            <th className="pb-2 pr-3 text-right">Incentive</th>
                            <th className="pb-2 pr-3 text-right">Equity</th>
                            <th className="pb-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stores.map((s, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`
                            const opCash = parseFloat(s.owner_profit_cash) || 0
                            const opAcct = parseFloat(s.owner_profit_account) || 0
                            return (
                              <tr key={s.store_name} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                                onClick={() => { setSelectedStore(s.store_name); setView('stores') }}>
                                <td className="py-2.5 pr-3">{medal}</td>
                                <td className="py-2.5 pr-3 font-medium text-gray-800">{s.store_name}</td>
                                <td className="py-2.5 pr-3 text-right text-orange-600 text-xs">{fmt(opCash)}</td>
                                <td className="py-2.5 pr-3 text-right text-emerald-700 text-xs">{fmt(opAcct)}</td>
                                <td className="py-2.5 pr-3 text-right text-green-600 font-medium">{fmt(s.owner_profit)}</td>
                                <td className="py-2.5 pr-3 text-right text-purple-600">{fmt(s.incentive)}</td>
                                <td className="py-2.5 pr-3 text-right text-blue-600">{fmt(s.equity)}</td>
                                <td className="py-2.5 text-right font-semibold text-gray-800">
                                  {fmt((parseFloat(s.owner_profit) || 0) + (parseFloat(s.incentive) || 0) + (parseFloat(s.equity) || 0))}
                                </td>
                              </tr>
                            )
                          })}
                          {(() => {
                            const totalCash = stores.reduce((s, r) => s + (parseFloat(r.owner_profit_cash) || 0), 0)
                            const totalAcct = stores.reduce((s, r) => s + (parseFloat(r.owner_profit_account) || 0), 0)
                            return (
                              <tr className="border-t-2 border-gray-200">
                                <td className="py-2.5 pr-3"></td>
                                <td className="py-2.5 pr-3 font-bold text-gray-900">Total</td>
                                <td className="py-2.5 pr-3 text-right font-bold text-orange-600 text-xs">{fmt(totalCash)}</td>
                                <td className="py-2.5 pr-3 text-right font-bold text-emerald-700 text-xs">{fmt(totalAcct)}</td>
                                <td className="py-2.5 pr-3 text-right font-bold text-green-600">{fmt(grandTotal)}</td>
                                <td className="py-2.5 pr-3 text-right font-bold text-purple-600">{fmt(totalIncentive)}</td>
                                <td className="py-2.5 pr-3 text-right font-bold text-blue-600">{fmt(totalEquity)}</td>
                                <td className="py-2.5 text-right font-bold text-gray-900">{fmt(grandTotal + totalIncentive + totalEquity)}</td>
                              </tr>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>

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
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">No data for this period</div>
            )
          })() : (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          )}
        </div>
      )}

      {/* ===== ACCOUNTS VIEW ===== */}
      {view === 'accounts' && (
        <div className="space-y-4">
          {/* Year / Custom selector */}
          <div className="flex flex-wrap items-center gap-3">
            {acctMode !== 'CUSTOM' && (
              <div className="flex items-center gap-1">
                <button onClick={() => setAcctYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <span className="text-base font-bold text-gray-900 min-w-[3rem] text-center">{acctYear}</span>
                <button onClick={() => setAcctYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            )}
            <div className="flex bg-gray-100 rounded-xl p-1">
              {[{ key: 'YEAR', label: 'Year' }, { key: 'CUSTOM', label: 'Custom' }].map(p => (
                <button key={p.key} onClick={() => setAcctMode(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    acctMode === p.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>{p.label}</button>
              ))}
            </div>
            {acctMode === 'CUSTOM' && (
              <div className="flex items-center gap-2">
                <input type="date" value={acctStart} onChange={e => setAcctStart(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                <span className="text-gray-400 text-xs">~</span>
                <input type="date" value={acctEnd} onChange={e => setAcctEnd(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
              </div>
            )}
          </div>
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
          {/* Period selector for store view */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <button onClick={() => setYear(y => y - 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span className="text-base font-bold text-gray-900 min-w-[3rem] text-center">{year}</span>
              <button onClick={() => setYear(y => y + 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            <div className="flex bg-gray-100 rounded-xl p-1">
              {[{ key: 'H1', label: 'H1' }, { key: 'H2', label: 'H2' }, { key: 'CUSTOM', label: 'Custom' }].map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    period === p.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>{p.label}</button>
              ))}
            </div>
            {period === 'CUSTOM' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                <span className="text-gray-400 text-xs">~</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
              className={inputCls + ' flex-1'}>
              <option value="">Select store...</option>
              {storesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {selectedStore && !storeLockStatus.is_locked && (
              <button onClick={() => { setForm(f => ({ ...f, store_name: selectedStore })); setShowForm(true) }}
                className="px-3 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-1">
                <PlusIcon className="w-4 h-4" /> Add
              </button>
            )}
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

          {/* Add Transaction Form (inside store view) */}
          {showForm && selectedStore && (
            <Card>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Add Transaction — {selectedStore}</h3>
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
          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span className="text-base font-bold text-gray-900 min-w-[3rem] text-center">{year}</span>
              <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            <div className="flex bg-gray-100 rounded-xl p-1">
              {[{ key: 'H1', label: 'H1' }, { key: 'H2', label: 'H2' }, { key: 'CUSTOM', label: 'Custom' }].map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    period === p.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>{p.label}</button>
              ))}
            </div>
            {period === 'CUSTOM' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                <span className="text-gray-400 text-xs">~</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
              </div>
            )}
          </div>
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

    </div>
  )
}

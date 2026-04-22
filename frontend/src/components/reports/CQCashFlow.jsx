import React, { useState, useEffect } from 'react'
import { cqTransactionAPI, cqAPI, cashExpenseAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
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

// Get H1/H2/YEAR date ranges: H1=Apr-Sep, H2=Oct-Mar, YEAR=Apr-Mar
function getPeriodDates(year, period) {
  if (period === 'YEAR') {
    return { start: `${year}-04-01`, end: `${year + 1}-03-31` }
  }
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
  const { user } = useAuth()
  const isCEO = user?.role === 'CEO' || user?.role === 'HQ'
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
  const [stmtStoreFilter, setStmtStoreFilter] = useState('')
  const [stmtTypeFilter, setStmtTypeFilter] = useState('')
  const [stmtSearch, setStmtSearch] = useState('')
  const [openingBalance, setOpeningBalance] = useState({ amount: '', date: '' })
  const [showOpeningForm, setShowOpeningForm] = useState(false)
  const [acctYear, setAcctYear] = useState(new Date().getFullYear())
  const [acctMode, setAcctMode] = useState('YEAR') // '6M', 'YEAR', 'CUSTOM'
  const [acctStart, setAcctStart] = useState('')
  const [acctEnd, setAcctEnd] = useState('')

  // Computed account date range
  const acctDateRange = (() => {
    if (acctMode === 'CUSTOM') return { start: acctStart, end: acctEnd }
    if (acctMode === 'YEAR') return { start: `${acctYear}-01-01`, end: `${acctYear}-12-31` }
    // 6M: last 6 months from today
    const now = new Date()
    const sixAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    return { start: localDateStr(sixAgo), end: localDateStr(now) }
  })()

  // Pending expenses for approval
  const [pendingExpenses, setPendingExpenses] = useState([])

  // Edit transaction (CEO only)
  const [editingTx, setEditingTx] = useState(null)
  // Detail view (tap row to see details like attachment)
  const [detailTx, setDetailTx] = useState(null)

  // Account expense form (KRW: direct save, QT/ChCh: needs approval)
  const [expForm, setExpForm] = useState({ date: localDateStr(new Date()), description: '', amount: '', category: 'EXPENSE', exchangeRate: '', krwAmount: '', attachment: null })

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
  const loadData = () => { loadPeriodData(); loadHistoryData(); loadPendingExpenses() }

  const loadStoreLedger = async () => {
    if (!selectedStore) return
    try {
      const [res, lockRes] = await Promise.all([
        cqTransactionAPI.storeLedger({
          store_name: selectedStore,
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

  const loadOpeningBalance = async () => {
    if (!selectedAccount) return
    try {
      const res = await cqTransactionAPI.getOpeningBalance(selectedAccount)
      setOpeningBalance({
        amount: res.data.amount ? String(res.data.amount) : '',
        date: res.data.date || '',
      })
    } catch (e) { /* ignore */ }
  }

  const handleSaveOpeningBalance = async () => {
    if (!openingBalance.amount || !openingBalance.date) {
      alert('금액과 날짜를 입력하세요')
      return
    }
    try {
      await cqTransactionAPI.setOpeningBalance({
        account: selectedAccount,
        amount: openingBalance.amount,
        date: openingBalance.date,
      })
      setShowOpeningForm(false)
      loadAccountStatement()
    } catch (e) {
      alert('저장 실패')
    }
  }

  const loadPendingExpenses = async () => {
    try {
      const res = await cqAPI.listExpenses({ status: 'PENDING' })
      setPendingExpenses(res.data?.results || res.data || [])
    } catch (e) { /* ignore */ }
  }

  const handleApproveExpense = async (expenseId) => {
    try {
      await cqAPI.approveExpense(expenseId)
      loadPendingExpenses()
      loadAccountStatement()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to approve')
    }
  }

  const handleEditTx = async (tx) => {
    if (!isCEO) return
    const idStr = String(tx.id)
    const isExpense = idStr.startsWith('exp_')
    // Extract real description for CQExpense (strip "[CQ Expense] " prefix from note)
    const noteRaw = tx.note || ''
    const description = isExpense ? noteRaw.replace(/^\[CQ Expense\]\s*/, '') : ''
    setEditingTx({
      id: tx.id,
      date: tx.date,
      // For CQExpense: show description in store_name edit field (it's the main editable text)
      store_name: isExpense ? description : (tx.store_name || ''),
      amount: Math.abs(tx.amount),
      note: isExpense ? '' : (tx.note || ''),
      transaction_type: tx.transaction_type,
      is_expense: isExpense,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingTx) return
    try {
      if (editingTx.is_expense) {
        const realId = String(editingTx.id).replace(/^exp_/, '')
        await cqAPI.updateExpense(realId, {
          date: editingTx.date,
          description: editingTx.store_name, // store_name field holds the description in edit form
          amount: editingTx.amount,
        })
      } else {
        await cqTransactionAPI.update(editingTx.id, {
          date: editingTx.date,
          store_name: editingTx.store_name,
          amount: editingTx.amount,
          note: editingTx.note,
        })
      }
      setEditingTx(null)
      loadAccountStatement()
      showMsg('Updated')
    } catch (e) {
      const d = e.response?.data
      const msg = typeof d === 'string' ? d : d?.detail || d?.error || d?.non_field_errors?.[0] || JSON.stringify(d) || 'Failed to update'
      setError(msg)
    }
  }

  const handleDeleteTx = async (txId) => {
    if (!isCEO) return
    if (!confirm('Delete this entry?')) return
    try {
      const idStr = String(txId)
      if (idStr.startsWith('exp_')) {
        const realId = idStr.replace(/^exp_/, '')
        await cqAPI.deleteExpense(realId)
      } else {
        await cqTransactionAPI.delete(txId)
      }
      loadAccountStatement()
      showMsg('Deleted')
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.detail || 'Failed to delete')
    }
  }

  const handleSaveExpense = async () => {
    if (!expForm.date || !expForm.amount) return
    try {
      if (expForm.category === 'EXCHANGE') {
        // Exchange: NZD expense from current account + KRW income to KRW account
        if (!expForm.krwAmount) {
          setError('KRW 금액을 입력하세요')
          return
        }
        const rateInfo = expForm.exchangeRate ? ` @${expForm.exchangeRate}` : ''
        const desc = expForm.description || `환전 → KRW ₩${Number(expForm.krwAmount).toLocaleString()}${rateInfo}`
        // 1) NZD expense from QT/ChCh
        const formData = new FormData()
        formData.append('date', expForm.date)
        formData.append('account', selectedAccount.toUpperCase())
        formData.append('category', 'EXCHANGE')
        formData.append('description', desc)
        formData.append('amount', expForm.amount)
        if (expForm.exchangeRate) formData.append('exchange_rate', expForm.exchangeRate)
        if (expForm.krwAmount) formData.append('krw_amount', expForm.krwAmount)
        if (expForm.attachment) formData.append('attachment', expForm.attachment)
        await cqAPI.createExpense(formData)
        // 2) KRW income
        await cqTransactionAPI.create({
          date: expForm.date,
          store_name: `환전 ← ${selectedAccount} $${Number(expForm.amount).toLocaleString()}${rateInfo}`,
          transaction_type: 'EXCHANGE',
          person: 'KRW',
          amount: expForm.krwAmount,
          account_type: 'KRW',
          note: desc,
        })
        loadPendingExpenses()
        showMsg('환전 저장됨 (NZD 승인 대기)')
      } else if (selectedAccount === 'KRW') {
        // KRW: direct CQTransaction (no approval)
        await cqTransactionAPI.create({
          date: expForm.date,
          store_name: expForm.description || '',
          transaction_type: expForm.category,
          person: 'KRW',
          amount: expForm.amount,
          account_type: 'KRW',
          note: expForm.description || '',
        })
        showMsg('저장됨')
      } else {
        // QT/ChCh: CQExpense with approval flow
        const formData = new FormData()
        formData.append('date', expForm.date)
        formData.append('account', selectedAccount.toUpperCase())
        formData.append('category', expForm.category)
        formData.append('description', expForm.description || '')
        formData.append('amount', expForm.amount)
        if (expForm.attachment) formData.append('attachment', expForm.attachment)
        await cqAPI.createExpense(formData)
        loadPendingExpenses()
        showMsg('승인 대기 중')
      }
      setExpForm({ date: localDateStr(new Date()), description: '', amount: '', category: 'EXPENSE', exchangeRate: '', krwAmount: '', attachment: null })
      // Reset file input
      const fileInput = document.getElementById('expense-attachment')
      if (fileInput) fileInput.value = ''
      loadAccountStatement()
    } catch (e) {
      const detail = e.response?.data?.detail || e.response?.data?.error || JSON.stringify(e.response?.data) || 'Failed to save'
      setError(detail)
    }
  }

  // Load pending expenses when entering Accounts view
  useEffect(() => {
    if (view === 'accounts') loadPendingExpenses()
  }, [view])

  useEffect(() => {
    if (view === 'accounts' && selectedAccount) {
      if (acctMode === 'CUSTOM' && (!acctStart || !acctEnd)) return
      if (acctDateRange.start && acctDateRange.end) loadAccountStatement()
      loadOpeningBalance()
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
            className={`relative px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              view === v.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {v.label}
            {v.key === 'accounts' && pendingExpenses.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {pendingExpenses.length}
              </span>
            )}
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
            // Per-store data for this period — show ALL registered stores,
            // sorted by owner_profit desc (zero-value stores still listed)
            const stores = (summary.stores || [])
              .slice()
              .sort((a, b) => parseFloat(b.owner_profit || 0) - parseFloat(a.owner_profit || 0))
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
                                <th className="pb-2 pr-3">Name</th>
                                <th className="pb-2 pr-3 text-right">Incentive</th>
                                <th className="pb-2 pr-3 text-right">Equity Share</th>
                                <th className="pb-2 pr-3 text-right text-green-600">Cash</th>
                                <th className="pb-2 pr-3 text-right text-indigo-600">Account</th>
                                <th className="pb-2 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {partners.map(p => {
                                const inc = parseFloat(p.by_type?.incentive) || 0
                                const prf = parseFloat(p.by_type?.profit) || 0
                                const cash = (parseFloat(p.by_type?.incentive_cash) || 0) + (parseFloat(p.by_type?.profit_cash) || 0)
                                const acct = (parseFloat(p.by_type?.incentive_account) || 0) + (parseFloat(p.by_type?.profit_account) || 0)
                                return (
                                  <tr key={p.person} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => { setSelectedPerson(p.person); setView('persons') }}>
                                    <td className="py-2.5 pr-3 font-medium text-gray-800">{p.person}</td>
                                    <td className="py-2.5 pr-3 text-right text-purple-600">{fmt(inc)}</td>
                                    <td className="py-2.5 pr-3 text-right text-blue-600">{fmt(prf)}</td>
                                    <td className="py-2.5 pr-3 text-right text-green-600">{fmt(cash)}</td>
                                    <td className="py-2.5 pr-3 text-right text-indigo-600">{fmt(acct)}</td>
                                    <td className="py-2.5 text-right font-semibold text-gray-800">{fmt(inc + prf)}</td>
                                  </tr>
                                )
                              })}
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
          {/* 6M / Year / Custom selector */}
          <div className="flex flex-wrap items-center gap-3">
            {acctMode === 'YEAR' && (
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
              {[{ key: '6M', label: '6 Months' }, { key: 'YEAR', label: 'Year' }, { key: 'CUSTOM', label: 'Custom' }].map(p => (
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

          {/* Opening Balance */}
          {isCEO && (
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">Opening Balance</h3>
                    <div className="text-xs text-gray-500 mt-1">
                      {openingBalance.date ? (
                        <>기준일 {openingBalance.date} · <span className="font-semibold text-gray-800">{(selectedAccount === 'KRW' ? fmtKRW : fmt)(parseFloat(openingBalance.amount) || 0)}</span></>
                      ) : '시작 잔액이 설정되지 않았습니다'}
                    </div>
                  </div>
                  <button onClick={() => setShowOpeningForm(v => !v)}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                    {showOpeningForm ? '닫기' : (openingBalance.date ? '수정' : '설정')}
                  </button>
                </div>
                {showOpeningForm && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <input type="date" value={openingBalance.date}
                      onChange={e => setOpeningBalance(p => ({ ...p, date: e.target.value }))}
                      className="px-2 py-2 text-sm border rounded-xl bg-gray-50" />
                    <input type="number" value={openingBalance.amount}
                      placeholder={selectedAccount === 'KRW' ? '₩ 시작 잔액' : '$ 시작 잔액'}
                      onChange={e => setOpeningBalance(p => ({ ...p, amount: e.target.value }))}
                      className="px-2 py-2 text-sm border rounded-xl bg-gray-50" />
                    <button onClick={handleSaveOpeningBalance}
                      className="px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                      저장
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Expense Form */}
          {isCEO && (
            <Card>
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  {selectedAccount === 'KRW' ? 'KRW 입력' : `${selectedAccount} 지출 입력`}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input type="date" value={expForm.date}
                    onChange={e => setExpForm(p => ({ ...p, date: e.target.value }))}
                    className="px-2 py-2 text-sm border rounded-xl bg-gray-50" />
                  <input type="text" value={expForm.description} placeholder="내용"
                    onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))}
                    className="px-2 py-2 text-sm border rounded-xl bg-gray-50" />
                  <input type="number" value={expForm.amount}
                    placeholder={selectedAccount === 'KRW' ? '금액 (₩)' : 'NZD ($)'}
                    onChange={e => setExpForm(p => ({ ...p, amount: e.target.value }))}
                    className="px-2 py-2 text-sm border rounded-xl bg-gray-50" />
                  <select value={expForm.category}
                    onChange={e => setExpForm(p => ({ ...p, category: e.target.value }))}
                    className="px-2 py-2 text-sm border rounded-xl bg-gray-50">
                    {selectedAccount === 'KRW' ? (
                      <>
                        <option value="EXPENSE">지출</option>
                        <option value="COLLECTION">입금</option>
                        <option value="EXCHANGE">환전</option>
                        <option value="TRANSFER">이체</option>
                      </>
                    ) : (
                      <>
                        <option value="EXPENSE">지출</option>
                        <option value="EXCHANGE">환전</option>
                        <option value="COLLECTION">입금</option>
                        <option value="TRANSFER">이체</option>
                      </>
                    )}
                  </select>
                </div>
                {/* Exchange: exchange rate + KRW amount */}
                {expForm.category === 'EXCHANGE' && selectedAccount !== 'KRW' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <input type="number" value={expForm.exchangeRate} placeholder="환율 (₩ / $1 NZD)"
                        onChange={e => {
                          const rate = e.target.value
                          const krw = rate && expForm.amount ? Math.round(Number(rate) * Number(expForm.amount)) : ''
                          setExpForm(p => ({ ...p, exchangeRate: rate, krwAmount: krw ? String(krw) : '' }))
                        }}
                        className="w-full px-2 py-2 text-sm border rounded-xl bg-gray-50" />
                      <div className="text-xs text-gray-400 mt-0.5">환율</div>
                    </div>
                    <div>
                      <input type="number" value={expForm.krwAmount} placeholder="KRW 금액 (₩)"
                        onChange={e => setExpForm(p => ({ ...p, krwAmount: e.target.value }))}
                        className="w-full px-2 py-2 text-sm border rounded-xl bg-amber-50 border-amber-200" />
                      <div className="text-xs text-gray-400 mt-0.5">KRW 수입</div>
                    </div>
                  </div>
                )}
                {/* File attachment */}
                <div className="flex items-center gap-3 mt-3">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-xl text-xs text-gray-600 cursor-pointer hover:bg-gray-200 transition-all">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                    {expForm.attachment ? expForm.attachment.name : '사진 첨부'}
                    <input id="expense-attachment" type="file" accept="image/*,.pdf" className="hidden"
                      onChange={e => setExpForm(p => ({ ...p, attachment: e.target.files[0] || null }))} />
                  </label>
                  {expForm.attachment && (
                    <button onClick={() => { setExpForm(p => ({ ...p, attachment: null })); const fi = document.getElementById('expense-attachment'); if (fi) fi.value = '' }}
                      className="text-xs text-red-500 hover:text-red-700">✕</button>
                  )}
                  <div className="flex-1" />
                  {selectedAccount !== 'KRW' && (
                    <span className="text-xs text-amber-600">* 승인 필요</span>
                  )}
                  <button onClick={handleSaveExpense}
                    className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all">
                    저장
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Pending Expenses - Approval */}
          {pendingExpenses.length > 0 && (
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">{pendingExpenses.length}</span>
                  <h3 className="text-sm font-bold text-gray-900">승인 대기</h3>
                </div>
                <div className="space-y-2">
                  {pendingExpenses.map(exp => (
                    <div key={exp.id} className="flex items-center gap-3 p-2.5 bg-amber-50/70 rounded-xl border border-amber-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">{exp.account}</span>
                          <span className="font-medium text-gray-900 truncate">{exp.description}</span>
                          <span className="font-bold text-red-600 ml-auto">
                            {exp.account === 'KRW' ? `₩${Number(exp.amount).toLocaleString()}` : `$${Number(exp.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{exp.date} · {exp.created_by_name || ''}</div>
                      </div>
                      <button onClick={() => handleApproveExpense(exp.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 whitespace-nowrap">
                        ✓ 승인
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {accountData && (() => {
            const f = selectedAccount === 'KRW' ? fmtKRW : fmt
            const isKRW = selectedAccount === 'KRW'
            return (
            <>
              {/* Ledger (statement) */}
              <Card>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="font-semibold text-gray-800">Statement</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={stmtStoreFilter} onChange={e => setStmtStoreFilter(e.target.value)}
                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
                        <option value="">All stores</option>
                        {Array.from(new Set((accountData.ledger || []).map(i => i.store_name).filter(Boolean))).sort().map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <select value={stmtTypeFilter} onChange={e => setStmtTypeFilter(e.target.value)}
                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
                        <option value="">All types</option>
                        <option value="in">입금 (+)</option>
                        <option value="out">출금 (-)</option>
                        <option value="COLLECTION">Collection</option>
                        <option value="PROFIT">Profit</option>
                        <option value="INCENTIVE">Incentive</option>
                        <option value="EXPENSE">Expense</option>
                        <option value="TRANSFER">Transfer</option>
                        <option value="BALANCE">Balance</option>
                      </select>
                      <input type="text" value={stmtSearch} onChange={e => setStmtSearch(e.target.value)}
                        placeholder="검색..."
                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg w-32" />
                    </div>
                  </div>

                  {/* Edit modal is rendered at bottom of component */}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-3">Date</th>
                          <th className="pb-2 pr-3">{isKRW ? '내용' : 'Store'}</th>
                          {!isKRW && <th className="pb-2 pr-3">Note</th>}
                          <th className="pb-2 pr-3 text-right">Amount</th>
                          {!isKRW && <th className="pb-2 text-right">Balance</th>}
                          {isCEO && <th className="pb-2 pl-2 w-20"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(accountData.ledger || []).filter(item => {
                          if (stmtStoreFilter && item.store_name !== stmtStoreFilter) return false
                          if (stmtTypeFilter) {
                            if (stmtTypeFilter === 'in' && !(item.amount >= 0)) return false
                            else if (stmtTypeFilter === 'out' && !(item.amount < 0)) return false
                            else if (!['in','out'].includes(stmtTypeFilter) && item.transaction_type !== stmtTypeFilter) return false
                          }
                          if (stmtSearch) {
                            const q = stmtSearch.toLowerCase()
                            const hay = `${item.store_name || ''} ${item.note || ''}`.toLowerCase()
                            if (!hay.includes(q)) return false
                          }
                          return true
                        }).map(item => {
                          const canEdit = isCEO && !item.is_locked
                          const isEditing = editingTx?.id === item.id
                          const isDetail = detailTx?.id === item.id && !isEditing
                          const colSpan = isKRW ? (isCEO ? 4 : 3) : (isCEO ? 6 : 5)
                          return (
                          <React.Fragment key={item.id}>
                          <tr
                            onClick={() => !isEditing && setDetailTx(isDetail ? null : item)}
                            className={`border-b border-gray-50 cursor-pointer ${item.source === 'cash_management' ? 'bg-amber-50/50' : ''} ${isEditing ? 'bg-blue-50' : isDetail ? 'bg-gray-50' : 'active:bg-gray-50'}`}>
                            <td className="py-2 pr-3 text-gray-600 text-xs">{item.date}</td>
                            <td className="py-2 pr-3 text-gray-800 text-xs">
                              {item.source === 'cash_management' ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                  {item.store_name || 'Expense'}
                                </span>
                              ) : (item.store_name || item.note)}
                            </td>
                            {!isKRW && <td className="py-2 pr-3 text-gray-500 text-[11px] hidden sm:table-cell">{item.note}</td>}
                            <td className={`py-2 pr-3 text-right font-medium text-xs ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {item.amount >= 0 ? '+' : ''}{f(item.amount)}
                            </td>
                            {!isKRW && <td className="py-2 text-right font-medium text-gray-800 text-xs">{f(item.balance)}</td>}
                            {isCEO && (
                              <td className="py-2 pl-1" onClick={e => e.stopPropagation()}>
                                {canEdit && !isEditing && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <button onClick={() => { setDetailTx(null); handleEditTx(item) }} title="수정"
                                      className="p-1 text-gray-300 hover:text-blue-500 active:text-blue-600 rounded">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                    </button>
                                    <button onClick={() => handleDeleteTx(item.id)} title="삭제"
                                      className="p-1 text-gray-300 hover:text-red-500 active:text-red-600 rounded">
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                          {/* Detail row (tap to expand) */}
                          {isDetail && (
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <td colSpan={colSpan} className="px-3 py-2.5">
                                <div className="text-xs space-y-1.5">
                                  <div className="flex gap-4 flex-wrap">
                                    <span className="text-gray-400">Type: <span className="text-gray-700 font-medium">{item.transaction_type}</span></span>
                                    <span className="text-gray-400">Store: <span className="text-gray-700 font-medium">{item.store_name || '-'}</span></span>
                                    <span className="text-gray-400">Amount: <span className={`font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{f(item.amount)}</span></span>
                                  </div>
                                  {item.note && <div className="text-gray-400">Note: <span className="text-gray-700">{item.note}</span></div>}
                                  {item.attachment && (
                                    <div className="mt-2">
                                      <a href={item.attachment} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-blue-600 hover:bg-blue-50">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                        첨부파일 보기
                                      </a>
                                    </div>
                                  )}
                                  {item.source === 'cash_management' && (
                                    <div className="text-amber-600 text-[11px]">💰 Cash Management에서 자동 생성</div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          {/* Inline edit row */}
                          {isEditing && (
                            <tr className="bg-blue-50 border-b border-blue-100">
                              <td colSpan={colSpan} className="px-2 py-3">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <div>
                                    <label className="text-[10px] text-gray-500 block mb-0.5">Date</label>
                                    <input type="date" value={editingTx.date}
                                      onChange={e => setEditingTx(p => ({ ...p, date: e.target.value }))}
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500 block mb-0.5">Store</label>
                                    <input type="text" value={editingTx.store_name} placeholder="Store"
                                      onChange={e => setEditingTx(p => ({ ...p, store_name: e.target.value }))}
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500 block mb-0.5">Amount</label>
                                    <input type="number" value={editingTx.amount} placeholder="Amount"
                                      onChange={e => setEditingTx(p => ({ ...p, amount: e.target.value }))}
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500 block mb-0.5">Note</label>
                                    <input type="text" value={editingTx.note} placeholder="Note"
                                      onChange={e => setEditingTx(p => ({ ...p, note: e.target.value }))}
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={handleSaveEdit}
                                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg active:bg-blue-800">저장</button>
                                  <button onClick={() => handleDeleteTx(item.id)}
                                    className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg active:bg-red-100">삭제</button>
                                  <button onClick={() => setEditingTx(null)}
                                    className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg active:bg-gray-200">취소</button>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        )})}
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
              {/* Cash Summary Cards */}
              {(() => {
                const totalIn = storeLedger.ledger?.reduce((s, i) => s + i.income, 0) || 0
                const totalOut = storeLedger.ledger?.reduce((s, i) => s + i.expense, 0) || 0
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                      <div className="text-xs text-gray-500 mb-1">총 수금</div>
                      <div className="text-lg font-bold text-green-600">{fmt(totalIn)}</div>
                    </div>
                    <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                      <div className="text-xs text-gray-500 mb-1">총 지출</div>
                      <div className="text-lg font-bold text-red-600">{fmt(totalOut)}</div>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                      <div className="text-xs text-gray-500 mb-1">현재 잔액</div>
                      <div className={`text-lg font-bold ${(storeLedger.balance || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmt(storeLedger.balance || 0)}
                      </div>
                    </div>
                  </div>
                )
              })()}
              {/* Carry-over + Current Balance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                  <div className="text-xs text-gray-500 mb-1">이월 잔액</div>
                  <div className={`text-lg font-bold ${(storeLedger.carry_over || 0) >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                    {fmt(storeLedger.carry_over || 0)}
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                  <div className="text-xs text-gray-500 mb-1">현재 잔액</div>
                  <div className={`text-lg font-bold ${(storeLedger.balance || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmt(storeLedger.balance || 0)}
                  </div>
                </div>
              </div>

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
                        {(storeLedger.carry_over || 0) !== 0 && (
                          <tr className="border-t-2 border-amber-200 bg-amber-50/50">
                            <td className="py-2 pr-3 text-amber-700 font-medium" colSpan={3}>이월 잔액 (Carry-over)</td>
                            <td className="py-2 pr-3 text-right text-amber-700 font-medium">
                              {storeLedger.carry_over > 0 ? fmt(storeLedger.carry_over) : ''}
                            </td>
                            <td className="py-2 pr-3 text-right text-amber-700 font-medium">
                              {storeLedger.carry_over < 0 ? fmt(Math.abs(storeLedger.carry_over)) : ''}
                            </td>
                            <td className="py-2 text-right font-bold text-amber-800">{fmt(storeLedger.carry_over)}</td>
                            <td></td>
                          </tr>
                        )}
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
              {[{ key: 'YEAR', label: 'Year' }, { key: 'H1', label: 'H1' }, { key: 'H2', label: 'H2' }, { key: 'CUSTOM', label: 'Custom' }].map(p => (
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

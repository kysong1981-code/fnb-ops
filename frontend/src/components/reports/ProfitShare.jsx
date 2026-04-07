import { useState, useEffect, useCallback } from 'react'
import { profitShareAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import PageHeader from '../ui/PageHeader'
import Card, { CardHeader, CardBody } from '../ui/Card'
import { MoneyIcon } from '../icons'

const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const readOnlyCls = 'w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-right text-gray-500'
const labelCls = 'text-xs text-gray-500 mb-1 block'
const selectCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function fmt(v) {
  if (v === null || v === undefined || v === '' || v === '0.00' || v === '0') return '-'
  const n = parseFloat(v)
  if (isNaN(n) || n === 0) return '-'
  return '$' + n.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDec(v) {
  if (v === null || v === undefined || v === '' || v === '0.00' || v === '0') return '-'
  const n = parseFloat(v)
  if (isNaN(n) || n === 0) return '-'
  return '$' + n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function periodLabel(year, periodType) {
  if (periodType === 'H1') return `${year} H1 (Apr-Sep)`
  return `${year} H2 (Oct-Mar)`
}

const EMPTY_SUMMARY = {
  account_revenue: '',
  account_25: '',
  tax: '',
  net_profit_account: '',
  net_profit_cash: '',
  incentive_account: '',
  incentive_cash: '',
  incentive_pct: '',
  evaluation_score: 0,
  notes: '',
}

const EMPTY_PARTNER = {
  name: '',
  partner_type: 'EQUITY',
  incentive_pct: '',
  equity_pct: '',
  fixed_amount: '',
  fixed_account: '',
  fixed_cash: '',
  notes: '',
  order: 0,
}

export default function ProfitShare() {
  const { user } = useAuth()
  const { stores, selectedStore } = useStore()
  const [year, setYear] = useState(new Date().getFullYear())
  const currentMonth = new Date().getMonth() + 1
  const [periodType, setPeriodType] = useState(currentMonth >= 4 && currentMonth <= 9 ? 'H1' : 'H2')
  const [summary, setSummary] = useState({ ...EMPTY_SUMMARY })
  const [partners, setPartners] = useState([])
  const [profitShareId, setProfitShareId] = useState(null)
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [historyData, setHistoryData] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [pullingScore, setPullingScore] = useState(false)
  const [scoreData, setScoreData] = useState(null)
  const [skyData, setSkyData] = useState(null)

  const isCEO = user?.role === 'CEO' || user?.role === 'HQ'

  useEffect(() => {
    loadProfitShare()
    loadSkyData()
  }, [selectedStore?.id, year, periodType])

  useEffect(() => {
    loadHistory()
  }, [selectedStore?.id])

  const loadSkyData = async () => {
    if (!selectedStore?.id) return
    try {
      const res = await profitShareAPI.pullSkyData(year, periodType, selectedStore.id)
      const data = res.data
      setSkyData(data)
      // Auto-fill cash into summary if not yet set
      if (data && data.available_cash > 0) {
        setSummary(prev => ({
          ...prev,
          net_profit_cash: prev.net_profit_cash || data.available_cash,
        }))
      }
    } catch {
      setSkyData(null)
    }
  }

  const loadHistory = async () => {
    if (!selectedStore?.id) return
    setHistoryLoading(true)
    try {
      const res = await profitShareAPI.history(selectedStore.id)
      setHistoryData(res.data || [])
    } catch (err) {
      console.warn('Failed to load history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadProfitShare = async () => {
    if (!selectedStore?.id) return
    setLoading(true)
    setError('')
    try {
      const res = await profitShareAPI.list({
        store_id: selectedStore.id,
        year,
        period_type: periodType,
      })
      const data = res.data?.results || res.data
      if (Array.isArray(data) && data.length > 0) {
        const ps = data[0]
        setProfitShareId(ps.id)
        setIsLocked(ps.is_locked)
        setSummary({
          account_revenue: ps.account_revenue || '',
          account_25: ps.account_25 || '',
          tax: ps.tax || '',
          net_profit_account: ps.net_profit_account || '',
          net_profit_cash: ps.net_profit_cash || '',
          incentive_account: ps.incentive_account || '',
          incentive_cash: ps.incentive_cash || '',
          incentive_pct: ps.incentive_pct || '',
          evaluation_score: ps.evaluation_score || 0,
          notes: ps.notes || '',
        })
        if (ps.evaluation_score > 0) {
          setScoreData({ total_score: ps.evaluation_score, score_percentage: ps.evaluation_score / 100 })
        } else {
          setScoreData(null)
        }
        setPartners((ps.partners || []).map(p => ({
          id: p.id,
          name: p.name || '',
          partner_type: p.partner_type || 'EQUITY',
          incentive_pct: p.incentive_pct || '',
          equity_pct: p.equity_pct || '',
          fixed_amount: p.fixed_amount || '',
          fixed_account: p.fixed_account || '',
          fixed_cash: p.fixed_cash || '',
          notes: p.notes || '',
          order: p.order || 0,
          // Read-only calculated fields (prefixed with _ to distinguish)
          _incentive_account: p.incentive_account,
          _incentive_cash: p.incentive_cash,
          _bank_account: p.bank_account,
          _bank_cash: p.bank_cash,
          _total_account: p.total_account,
          _total_cash: p.total_cash,
          _total: p.total,
        })))
      } else {
        setProfitShareId(null)
        setIsLocked(false)
        setSummary({ ...EMPTY_SUMMARY })
        setPartners([])
        setScoreData(null)
      }
    } catch (err) {
      console.error('Failed to load profit share:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSummaryChange = (field, value) => {
    setSummary(prev => ({ ...prev, [field]: value }))
  }

  const handlePartnerChange = (index, updates) => {
    // Accept either an object of multiple fields or will be called with object
    setPartners(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], ...updates }
      return updated
    })
  }

  const addPartner = () => {
    setPartners(prev => [...prev, { ...EMPTY_PARTNER, order: prev.length }])
  }

  const removePartner = (index) => {
    setPartners(prev => prev.filter((_, i) => i !== index))
  }

  const copyFromPrevious = async () => {
    if (!selectedStore?.id) return
    // Previous period: H1->previous H2, H2->same year H1
    const prevPeriod = periodType === 'H1' ? 'H2' : 'H1'
    const prevYear = periodType === 'H1' ? year - 1 : year
    try {
      const res = await profitShareAPI.list({
        store_id: selectedStore.id,
        year: prevYear,
        period_type: prevPeriod,
      })
      const data = res.data?.results || res.data
      if (Array.isArray(data) && data.length > 0) {
        const prev = data[0]
        setPartners((prev.partners || []).map((p, i) => ({
          name: p.name || '',
          partner_type: p.partner_type || 'EQUITY',
          incentive_pct: p.incentive_pct || '',
          equity_pct: p.equity_pct || '',
          fixed_amount: p.fixed_amount || '',
          fixed_account: p.fixed_account || '',
          fixed_cash: p.fixed_cash || '',
          notes: '',
          order: i,
        })))
        setSuccess(`Copied ${prev.partners?.length || 0} partners from ${prevYear} ${prevPeriod}`)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(`No previous period data found (${prevYear} ${prevPeriod})`)
        setTimeout(() => setError(''), 3000)
      }
    } catch (err) {
      setError('Failed to load previous period')
      setTimeout(() => setError(''), 3000)
    }
  }

  // Auto-calculate computed fields locally for preview
  const totalRevenue = (parseFloat(summary.account_revenue) || 0) + (parseFloat(summary.account_25) || 0)
  const incentiveTotal = (parseFloat(summary.incentive_account) || 0) + (parseFloat(summary.incentive_cash) || 0)

  const handleSave = async () => {
    if (!selectedStore?.id) return
    setSaving(true)
    setError('')
    setSuccess('')

    const n = (v) => parseFloat(v) || 0
    const payload = {
      year,
      period_type: periodType,
      account_revenue: n(summary.account_revenue),
      account_25: n(summary.account_25),
      tax: n(summary.tax),
      bank_account: 0,
      bank_cash: 0,
      net_profit_account: n(summary.net_profit_account),
      net_profit_cash: n(summary.net_profit_cash),
      incentive_account: n(summary.incentive_account),
      incentive_cash: n(summary.incentive_cash),
      incentive_pct: n(summary.incentive_pct),
      evaluation_score: parseInt(summary.evaluation_score) || 0,
      notes: summary.notes || '',
      partners: partners.map((p, i) => ({
        ...(p.id ? { id: p.id } : {}),
        name: p.name || 'Partner',
        partner_type: p.partner_type,
        incentive_pct: n(p.incentive_pct),
        equity_pct: n(p.equity_pct),
        fixed_amount: n(p.fixed_account) + n(p.fixed_cash) || n(p.fixed_amount),
        fixed_account: n(p.fixed_account),
        fixed_cash: n(p.fixed_cash),
        notes: p.notes || '',
        order: i,
      })),
    }

    try {
      let res
      if (profitShareId) {
        res = await profitShareAPI.update(profitShareId, payload)
      } else {
        res = await profitShareAPI.create(payload)
      }
      const ps = res.data
      // Auto-calculate after save (non-blocking)
      if (ps.id) {
        try {
          await profitShareAPI.autoCalculate(ps.id)
        } catch (calcErr) {
          console.warn('Auto-calculate skipped:', calcErr)
        }
      }
      setSuccess('Saved successfully')
      setTimeout(() => setSuccess(''), 3000)
      loadProfitShare()
      loadHistory()
    } catch (err) {
      console.error('Save error:', err?.response?.status, err?.response?.data)
      setError(err.response?.data?.detail || err.response?.data?.error || JSON.stringify(err.response?.data) || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!profitShareId) return
    if (!window.confirm('Are you sure you want to delete this profit share record?')) return
    try {
      await profitShareAPI.delete(profitShareId)
      setProfitShareId(null)
      setSummary({ ...EMPTY_SUMMARY })
      setPartners([])
      setSuccess('Deleted successfully')
      setTimeout(() => setSuccess(''), 3000)
      loadHistory()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete')
    }
  }

  const handleToggleLock = async () => {
    if (!profitShareId) return
    try {
      const res = await profitShareAPI.toggleLock(profitShareId)
      setIsLocked(res.data.is_locked)
      setSuccess(res.data.is_locked ? 'Locked' : 'Unlocked')
      setTimeout(() => setSuccess(''), 3000)
      loadHistory()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle lock')
    }
  }

  const navigateToPeriod = (h) => {
    setYear(h.year)
    setPeriodType(h.period_type)
  }

  const handlePullScore = async () => {
    if (!selectedStore?.id) return
    setPullingScore(true)
    setError('')
    try {
      const res = await profitShareAPI.pullScore(year, periodType, selectedStore.id)
      const data = res.data
      setScoreData(data)
      setSummary(prev => ({ ...prev, evaluation_score: data.total_score || 0 }))
      setSuccess(`Evaluation score pulled: ${data.total_score}/100 (${(data.score_percentage * 100).toFixed(0)}%)`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'No evaluation found for this period. Create one in Store Evaluation first.')
    } finally {
      setPullingScore(false)
    }
  }

  const disabled = isLocked || !isCEO

  // History bar chart max
  const maxProfit = Math.max(...historyData.map(h => Math.abs(h.net_profit_total || 0)), 1)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader
        title="Partner Profit Share"
        icon={<MoneyIcon size={28} />}
        subtitle={selectedStore?.name || 'Select a store'}
      />

      {/* Period Selector */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Store selector for CEO */}
        {isCEO && stores.length > 1 && (
          <select
            value={selectedStore?.id || ''}
            onChange={(e) => {
              const store = stores.find(s => String(s.id) === e.target.value)
              if (store) {
                localStorage.setItem('selected_store_id', String(store.id))
                window.location.reload()
              }
            }}
            className={selectCls + ' w-48'}
          >
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {/* Year arrows */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1">
          <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 text-gray-500 hover:text-gray-900 text-lg font-bold">&larr;</button>
          <span className="text-sm font-semibold text-gray-700 min-w-[48px] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 text-gray-500 hover:text-gray-900 text-lg font-bold">&rarr;</button>
        </div>

        {/* Period toggle */}
        <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
          {['H1', 'H2'].map(p => (
            <button
              key={p}
              onClick={() => setPeriodType(p)}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                periodType === p
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {p === 'H1' ? 'H1 (Apr-Sep)' : 'H2 (Oct-Mar)'}
            </button>
          ))}
        </div>

        {/* Lock button */}
        {profitShareId && isCEO && (
          <button
            onClick={handleToggleLock}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              isLocked
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
            }`}
          >
            {isLocked ? 'Locked' : 'Unlocked'}
          </button>
        )}
      </div>

      {/* Messages */}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600">{success}</div>}
      {loading && <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">Loading...</div>}

      {/* History Overview */}
      {historyData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">History</h2>
          </CardHeader>
          <CardBody>
            {/* Bar Chart */}
            <div className="flex items-end gap-2 h-32 mb-4">
              {historyData.map(h => {
                const profit = h.net_profit_total || 0
                const heightPct = maxProfit > 0 ? (Math.abs(profit) / maxProfit) * 100 : 0
                const isNegative = profit < 0
                const isCurrent = h.year === year && h.period_type === periodType
                return (
                  <div
                    key={h.id}
                    className="flex-1 flex flex-col items-center justify-end cursor-pointer"
                    onClick={() => navigateToPeriod(h)}
                    title={`${periodLabel(h.year, h.period_type)}: ${fmt(profit)}`}
                  >
                    <span className="text-xs text-gray-500 mb-1">{fmt(profit)}</span>
                    <div
                      className={`w-full rounded-t transition-all ${
                        isCurrent
                          ? 'bg-blue-600'
                          : isNegative
                            ? 'bg-red-400'
                            : 'bg-blue-400'
                      }`}
                      style={{ height: `${Math.max(heightPct, 4)}%`, minHeight: '4px' }}
                    />
                    <span className={`text-xs mt-1 ${isCurrent ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                      {h.year} {h.period_type}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Period</th>
                    <th className="text-right pb-2 font-medium">Net Profit</th>
                    <th className="text-right pb-2 font-medium">Incentive</th>
                    <th className="text-center pb-2 font-medium">Partners</th>
                    <th className="text-center pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {historyData.map(h => {
                    const isCurrent = h.year === year && h.period_type === periodType
                    return (
                      <tr
                        key={h.id}
                        onClick={() => navigateToPeriod(h)}
                        className={`cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${isCurrent ? 'bg-blue-50' : ''}`}
                      >
                        <td className={`py-2 ${isCurrent ? 'font-semibold text-blue-600' : ''}`}>
                          {periodLabel(h.year, h.period_type)}
                        </td>
                        <td className="py-2 text-right">{fmt(h.net_profit_total)}</td>
                        <td className="py-2 text-right">{fmt(h.incentive_total)}</td>
                        <td className="py-2 text-center">{h.partner_count}</td>
                        <td className="py-2 text-center">{h.is_locked ? '\uD83D\uDD12' : 'Open'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Sky Report Reference */}
      {skyData && (
        <Card className="mb-6">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500">📊 Sky Report — {skyData.period}</h2>
              <span className="text-xs text-gray-400">{skyData.report_count} months</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Sales (inc GST)</div>
                <div className="text-base font-bold text-blue-700">{fmt(skyData.total_sales_inc_gst)}</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Operating Profit</div>
                <div className="text-base font-bold text-emerald-700">{fmt(skyData.total_operating_profit)}</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">HQ Cash</div>
                <div className="text-base font-bold text-amber-700">{fmt(skyData.total_hq_cash)}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Payable GST</div>
                <div className="text-base font-bold text-red-600">{fmt(skyData.total_payable_gst)}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-[10px] text-gray-400">COGS</div>
                <div className="text-sm font-semibold text-gray-700">{fmt(skyData.total_cogs)} <span className="text-xs text-gray-400">({skyData.cogs_ratio}%)</span></div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-[10px] text-gray-400">Wages</div>
                <div className="text-sm font-semibold text-gray-700">{fmt(skyData.total_wages)} <span className="text-xs text-gray-400">({skyData.wage_ratio}%)</span></div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-[10px] text-gray-400">Op Expenses</div>
                <div className="text-sm font-semibold text-gray-700">{fmt(skyData.total_operating_expenses)}</div>
              </div>
            </div>
            {/* CQ Cash Summary */}
            {(skyData.cq_cash_balance > 0 || skyData.prev_carry_over > 0) && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Cash (from CQ Report)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2 bg-violet-50 rounded-lg border border-violet-100">
                    <div className="text-[10px] text-gray-400">Prev Balance</div>
                    <div className="text-sm font-bold text-violet-700">{fmt(skyData.prev_carry_over)}</div>
                  </div>
                  <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                    <div className="text-[10px] text-gray-400">CQ Inflow</div>
                    <div className="text-sm font-bold text-green-700">{fmt(skyData.cq_cash_inflow)}</div>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                    <div className="text-[10px] text-gray-400">CQ Outflow</div>
                    <div className="text-sm font-bold text-red-600">{fmt(skyData.cq_cash_outflow)}</div>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="text-[10px] text-gray-400">Available</div>
                    <div className="text-sm font-bold text-blue-700">{fmt(skyData.available_cash)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Store Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Store Summary</h2>
        </CardHeader>
        <CardBody>
          {/* Revenue */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Revenue</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>00 Account</label>
                <input
                  type="number" step="0.01"
                  value={summary.account_revenue}
                  onChange={(e) => handleSummaryChange('account_revenue', e.target.value)}
                  className={disabled ? readOnlyCls : inputCls}
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>25 Account</label>
                <input
                  type="number" step="0.01"
                  value={summary.account_25}
                  onChange={(e) => handleSummaryChange('account_25', e.target.value)}
                  className={disabled ? readOnlyCls : inputCls}
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Total</label>
                <input
                  type="text"
                  value={fmt(totalRevenue)}
                  className={readOnlyCls}
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Tax */}
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Tax</label>
                <input
                  type="number" step="0.01"
                  value={summary.tax}
                  onChange={(e) => handleSummaryChange('tax', e.target.value)}
                  className={disabled ? readOnlyCls : inputCls}
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Net Profit</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Account</label>
                <input
                  type="number" step="0.01"
                  value={summary.net_profit_account}
                  onChange={(e) => handleSummaryChange('net_profit_account', e.target.value)}
                  className={disabled ? readOnlyCls : inputCls}
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Cash</label>
                <input
                  type="number" step="0.01"
                  value={summary.net_profit_cash}
                  onChange={(e) => handleSummaryChange('net_profit_cash', e.target.value)}
                  className={disabled ? readOnlyCls : inputCls}
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Incentive */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Incentive</h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Account</label>
                <input
                  type="number" step="0.01"
                  value={summary.incentive_account}
                  onChange={(e) => handleSummaryChange('incentive_account', e.target.value)}
                  className={disabled ? readOnlyCls : inputCls}
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Cash</label>
                <input
                  type="number" step="0.01"
                  value={summary.incentive_cash}
                  onChange={(e) => handleSummaryChange('incentive_cash', e.target.value)}
                  className={disabled ? readOnlyCls : inputCls}
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Total</label>
                <input
                  type="text"
                  value={fmt(incentiveTotal)}
                  className={readOnlyCls}
                  disabled
                />
              </div>
              <div>
                <label className={labelCls}>% of Net Profit</label>
                <input
                  type="text" inputMode="decimal"
                  value={summary._incentive_pct_display ?? (summary.incentive_pct ? (parseFloat(summary.incentive_pct) * 100) : '')}
                  onChange={(e) => {
                    const raw = e.target.value
                    const num = parseFloat(raw)
                    setSummary(prev => {
                      const updates = { ...prev, _incentive_pct_display: raw }
                      if (!isNaN(num)) {
                        const pct = num / 100
                        updates.incentive_pct = pct.toFixed(4)
                        const netAcc = parseFloat(prev.net_profit_account) || 0
                        const netCash = parseFloat(prev.net_profit_cash) || 0
                        updates.incentive_account = (netAcc * pct).toFixed(2)
                        updates.incentive_cash = (netCash * pct).toFixed(2)
                      }
                      return updates
                    })
                  }}
                  onBlur={(e) => {
                    const num = parseFloat(e.target.value)
                    if (!isNaN(num)) {
                      const pct = num / 100
                      setSummary(prev => {
                        const netAcc = parseFloat(prev.net_profit_account) || 0
                        const netCash = parseFloat(prev.net_profit_cash) || 0
                        return {
                          ...prev,
                          _incentive_pct_display: undefined,
                          incentive_pct: pct.toFixed(4),
                          incentive_account: (netAcc * pct).toFixed(2),
                          incentive_cash: (netCash * pct).toFixed(2),
                        }
                      })
                    }
                  }}
                  className={disabled ? readOnlyCls : inputCls}
                  disabled={disabled}
                  placeholder="10"
                />
              </div>
            </div>
          </div>

          {/* Evaluation Score */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Evaluation Score</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePullScore}
                disabled={disabled || pullingScore}
                className="px-4 py-2 bg-purple-50 text-purple-600 text-sm font-medium rounded-xl hover:bg-purple-100 border border-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pullingScore ? 'Pulling...' : 'Pull Evaluation Score'}
              </button>
              {(scoreData || summary.evaluation_score > 0) && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    Score: {summary.evaluation_score}/100 ({summary.evaluation_score}%)
                  </span>
                  {scoreData && (
                    <span className="text-xs text-gray-400">
                      Sales {scoreData.sales_score} | COGS {scoreData.cogs_score} | Wage {scoreData.wage_score} | Service {scoreData.service_score} | Hygiene {scoreData.hygiene_score} | Leadership {scoreData.leadership_score_points}
                    </span>
                  )}
                </div>
              )}
            </div>
            {(scoreData || summary.evaluation_score > 0) && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-xl p-3">
                  <p className="text-xs text-purple-600 mb-1">Actual Incentive Account</p>
                  <p className="text-sm font-semibold text-purple-800">
                    {fmt((parseFloat(summary.incentive_account) || 0) * (summary.evaluation_score / 100))}
                  </p>
                  <p className="text-xs text-gray-400">
                    {fmt(parseFloat(summary.incentive_account) || 0)} x {summary.evaluation_score}%
                  </p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3">
                  <p className="text-xs text-purple-600 mb-1">Actual Incentive Cash</p>
                  <p className="text-sm font-semibold text-purple-800">
                    {fmt((parseFloat(summary.incentive_cash) || 0) * (summary.evaluation_score / 100))}
                  </p>
                  <p className="text-xs text-gray-400">
                    {fmt(parseFloat(summary.incentive_cash) || 0)} x {summary.evaluation_score}%
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={summary.notes}
              onChange={(e) => handleSummaryChange('notes', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-gray-50'}`}
              disabled={disabled}
              rows={2}
              placeholder="Notes..."
            />
          </div>
        </CardBody>
      </Card>

      {/* Partner Cards */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Partners</h2>
          {!disabled && (
            <div className="flex gap-2">
              {partners.length === 0 && (
                <button
                  onClick={copyFromPrevious}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-all"
                >
                  Copy Previous
                </button>
              )}
              <button
                onClick={addPartner}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all"
              >
                + Add Partner
              </button>
            </div>
          )}
        </div>

        {partners.map((partner, index) => (
          <Card key={index}>
            <CardBody>
              {/* Partner header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <label className={labelCls}>Partner Name</label>
                  <input
                    type="text"
                    value={partner.name}
                    onChange={(e) => handlePartnerChange(index, { name: e.target.value })}
                    className={disabled ? readOnlyCls : inputCls}
                    style={{ textAlign: 'left' }}
                    disabled={disabled}
                    placeholder="Enter partner name"
                  />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                <select
                  value={partner.partner_type}
                  onChange={(e) => handlePartnerChange(index, { partner_type: e.target.value })}
                  className={selectCls + ' w-40'}
                  disabled={disabled}
                >
                  <option value="EQUITY">Equity</option>
                  <option value="NON_EQUITY">Non-Equity</option>
                  <option value="OWNER">Owner</option>
                </select>
                </div>
                {!disabled && (
                  <button
                    onClick={() => removePartner(index)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Remove partner"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Percentage inputs */}
              {partner.partner_type !== 'OWNER' && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className={labelCls}>Incentive %</label>
                    <div className="relative">
                      <input
                        type="text" inputMode="decimal"
                        value={partner._incentive_pct_display ?? (partner.incentive_pct ? (parseFloat(partner.incentive_pct) * 100) : '')}
                        onChange={(e) => {
                          const raw = e.target.value
                          const num = parseFloat(raw)
                          handlePartnerChange(index, {
                            _incentive_pct_display: raw,
                            ...(isNaN(num) ? {} : { incentive_pct: (num / 100).toFixed(4) }),
                          })
                        }}
                        onBlur={(e) => {
                          const num = parseFloat(e.target.value)
                          if (!isNaN(num)) {
                            handlePartnerChange(index, {
                              _incentive_pct_display: undefined,
                              incentive_pct: (num / 100).toFixed(4),
                            })
                          }
                        }}
                        className={disabled ? readOnlyCls : inputCls}
                        disabled={disabled}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Equity %</label>
                    <div className="relative">
                      <input
                        type="text" inputMode="decimal"
                        value={partner._equity_pct_display ?? (partner.equity_pct ? (parseFloat(partner.equity_pct) * 100) : '')}
                        onChange={(e) => {
                          const raw = e.target.value
                          const num = parseFloat(raw)
                          handlePartnerChange(index, {
                            _equity_pct_display: raw,
                            ...(isNaN(num) ? {} : { equity_pct: (num / 100).toFixed(4) }),
                          })
                        }}
                        onBlur={(e) => {
                          const num = parseFloat(e.target.value)
                          if (!isNaN(num)) {
                            handlePartnerChange(index, {
                              _equity_pct_display: undefined,
                              equity_pct: (num / 100).toFixed(4),
                            })
                          }
                        }}
                        className={disabled ? readOnlyCls : inputCls}
                        disabled={disabled}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Fixed Account</label>
                    <input
                      type="number" step="0.01"
                      value={partner.fixed_account}
                      onChange={(e) => handlePartnerChange(index, { fixed_account: e.target.value })}
                      className={disabled ? readOnlyCls : inputCls}
                      disabled={disabled}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Fixed Cash</label>
                    <input
                      type="number" step="0.01"
                      value={partner.fixed_cash}
                      onChange={(e) => handlePartnerChange(index, { fixed_cash: e.target.value })}
                      className={disabled ? readOnlyCls : inputCls}
                      disabled={disabled}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {partner.partner_type === 'OWNER' && (
                <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  Owner receives the remainder after all other partners are paid.
                </div>
              )}

              {/* Calculated amounts table */}
              {profitShareId && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400">
                        <th className="text-left pb-2 font-medium"></th>
                        <th className="text-right pb-2 font-medium">Account</th>
                        <th className="text-right pb-2 font-medium">Cash</th>
                        <th className="text-right pb-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      <tr>
                        <td className="py-1 text-gray-500">Incentive</td>
                        <td className="py-1 text-right">{fmtDec(partner._incentive_account)}</td>
                        <td className="py-1 text-right">{fmtDec(partner._incentive_cash)}</td>
                        <td className="py-1 text-right text-gray-400">{fmtDec((parseFloat(partner._incentive_account) || 0) + (parseFloat(partner._incentive_cash) || 0) || '')}</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-gray-500">Equity</td>
                        <td className="py-1 text-right">{fmtDec(partner._bank_account)}</td>
                        <td className="py-1 text-right">{fmtDec(partner._bank_cash)}</td>
                        <td className="py-1 text-right text-gray-400">{fmtDec((parseFloat(partner._bank_account) || 0) + (parseFloat(partner._bank_cash) || 0) || '')}</td>
                      </tr>
                      <tr className="font-semibold border-t border-gray-200">
                        <td className="py-1 pt-2">Total</td>
                        <td className="py-1 pt-2 text-right">{fmtDec(partner._total_account)}</td>
                        <td className="py-1 pt-2 text-right">{fmtDec(partner._total_cash)}</td>
                        <td className="py-1 pt-2 text-right text-blue-600">{fmtDec(partner._total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes</label>
                <input
                  type="text"
                  value={partner.notes}
                  onChange={(e) => handlePartnerChange(index, { notes: e.target.value })}
                  className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-gray-50'}`}
                  disabled={disabled}
                  placeholder="Notes..."
                />
              </div>
            </CardBody>
          </Card>
        ))}

        {partners.length === 0 && !loading && (
          <Card>
            <CardBody>
              <p className="text-center text-gray-400 text-sm py-4">No partners added yet.</p>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Actions */}
      {isCEO && (
        <div className="flex gap-3 mb-8">
          <button
            onClick={handleSave}
            disabled={saving || isLocked}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
              saving || isLocked
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : profitShareId ? 'Save Changes' : 'Create Profit Share'}
          </button>
          {profitShareId && !isLocked && (
            <button
              onClick={handleDelete}
              className="px-6 py-3 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

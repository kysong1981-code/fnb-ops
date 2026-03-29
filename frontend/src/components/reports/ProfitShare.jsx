import { useState, useEffect } from 'react'
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

function pctDisplay(v) {
  if (!v || parseFloat(v) === 0) return '-'
  return (parseFloat(v) * 100).toFixed(1) + '%'
}

const EMPTY_SUMMARY = {
  account_revenue: '',
  account_25: '',
  tax: '',
  bank_account: '',
  bank_cash: '',
  net_profit_account: '',
  net_profit_cash: '',
  incentive_account: '',
  incentive_cash: '',
  incentive_pct: '',
  notes: '',
}

const EMPTY_PARTNER = {
  name: '',
  partner_type: 'EQUITY',
  incentive_pct: '',
  equity_pct: '',
  fixed_amount: '',
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

  const isCEO = user?.role === 'CEO' || user?.role === 'HQ'

  useEffect(() => {
    loadProfitShare()
  }, [selectedStore?.id, year, periodType])

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
          bank_account: ps.bank_account || '',
          bank_cash: ps.bank_cash || '',
          net_profit_account: ps.net_profit_account || '',
          net_profit_cash: ps.net_profit_cash || '',
          incentive_account: ps.incentive_account || '',
          incentive_cash: ps.incentive_cash || '',
          incentive_pct: ps.incentive_pct || '',
          notes: ps.notes || '',
        })
        setPartners((ps.partners || []).map(p => ({
          id: p.id,
          name: p.name || '',
          partner_type: p.partner_type || 'EQUITY',
          incentive_pct: p.incentive_pct || '',
          equity_pct: p.equity_pct || '',
          fixed_amount: p.fixed_amount || '',
          notes: p.notes || '',
          order: p.order || 0,
          // Read-only calculated fields
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

  const handlePartnerChange = (index, field, value) => {
    setPartners(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addPartner = () => {
    setPartners(prev => [...prev, { ...EMPTY_PARTNER, order: prev.length }])
  }

  const removePartner = (index) => {
    setPartners(prev => prev.filter((_, i) => i !== index))
  }

  // Auto-calculate computed fields locally for preview
  const totalRevenue = (parseFloat(summary.account_revenue) || 0) + (parseFloat(summary.account_25) || 0)
  const totalBank = (parseFloat(summary.bank_account) || 0) + (parseFloat(summary.bank_cash) || 0)
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
      bank_account: n(summary.bank_account),
      bank_cash: n(summary.bank_cash),
      net_profit_account: n(summary.net_profit_account),
      net_profit_cash: n(summary.net_profit_cash),
      incentive_account: n(summary.incentive_account),
      incentive_cash: n(summary.incentive_cash),
      incentive_pct: n(summary.incentive_pct),
      notes: summary.notes || '',
      partners: partners.map((p, i) => ({
        ...(p.id ? { id: p.id } : {}),
        name: p.name || 'Partner',
        partner_type: p.partner_type,
        incentive_pct: n(p.incentive_pct),
        equity_pct: n(p.equity_pct),
        fixed_amount: n(p.fixed_amount),
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
      // Auto-calculate after save
      const ps = res.data
      if (ps.id) {
        await profitShareAPI.autoCalculate(ps.id)
      }
      setSuccess('Saved successfully')
      setTimeout(() => setSuccess(''), 3000)
      loadProfitShare()
    } catch (err) {
      console.error('Save error:', err)
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to save')
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
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle lock')
    }
  }

  const disabled = isLocked || !isCEO

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
                  type="number" step="0.01"
                  value={summary.incentive_pct ? (parseFloat(summary.incentive_pct) * 100).toFixed(1) : ''}
                  onChange={(e) => handleSummaryChange('incentive_pct', e.target.value ? (parseFloat(e.target.value) / 100).toFixed(4) : '')}
                  className={disabled ? readOnlyCls : inputCls}
                  disabled={disabled}
                  placeholder="10"
                />
              </div>
            </div>
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
            <button
              onClick={addPartner}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all"
            >
              + Add Partner
            </button>
          )}
        </div>

        {partners.map((partner, index) => (
          <Card key={index}>
            <CardBody>
              {/* Partner header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={partner.name}
                    onChange={(e) => handlePartnerChange(index, 'name', e.target.value)}
                    className={`text-base font-semibold bg-transparent border-b border-gray-200 focus:border-blue-500 focus:outline-none pb-1 w-full ${disabled ? 'text-gray-500' : 'text-gray-900'}`}
                    disabled={disabled}
                    placeholder="Partner name"
                  />
                </div>
                <select
                  value={partner.partner_type}
                  onChange={(e) => handlePartnerChange(index, 'partner_type', e.target.value)}
                  className={selectCls + ' w-40'}
                  disabled={disabled}
                >
                  <option value="EQUITY">Equity</option>
                  <option value="NON_EQUITY">Non-Equity</option>
                  <option value="OWNER">Owner</option>
                </select>
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
                        type="number" step="1" min="0" max="100"
                        value={partner.incentive_pct ? (parseFloat(partner.incentive_pct) * 100).toFixed(1) : ''}
                        onChange={(e) => handlePartnerChange(index, 'incentive_pct', e.target.value ? (parseFloat(e.target.value) / 100).toFixed(4) : '')}
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
                        type="number" step="1" min="0" max="100"
                        value={partner.equity_pct ? (parseFloat(partner.equity_pct) * 100).toFixed(1) : ''}
                        onChange={(e) => handlePartnerChange(index, 'equity_pct', e.target.value ? (parseFloat(e.target.value) / 100).toFixed(4) : '')}
                        className={disabled ? readOnlyCls : inputCls}
                        disabled={disabled}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Fixed Amount</label>
                    <input
                      type="number" step="0.01"
                      value={partner.fixed_amount}
                      onChange={(e) => handlePartnerChange(index, 'fixed_amount', e.target.value)}
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
                  onChange={(e) => handlePartnerChange(index, 'notes', e.target.value)}
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

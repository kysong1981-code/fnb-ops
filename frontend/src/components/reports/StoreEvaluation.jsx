import { useState, useEffect, useMemo } from 'react'
import { evaluationAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import PageHeader from '../ui/PageHeader'
import Card, { CardHeader, CardBody } from '../ui/Card'
import { ClipboardIcon } from '../icons'

const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const readOnlyCls = 'w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-right text-gray-500'
const labelCls = 'text-xs text-gray-500 mb-1 block'
const selectCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function fmt(v) {
  if (v === null || v === undefined || v === '' || v === '0.00' || v === '0') return '-'
  const n = parseFloat(v)
  if (isNaN(n) || n === 0) return '-'
  return n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const SCORE_CONFIG = [
  { key: 'sales', label: 'Sales', max: 25, hasTarget: true, unit: '$' },
  { key: 'cogs', label: 'COGS %', max: 20, hasTarget: true, unit: '%' },
  { key: 'wage', label: 'Wage %', max: 25, hasTarget: true, unit: '%' },
  { key: 'service', label: 'Service', max: 10, hasTarget: false, unit: 'rating' },
  { key: 'hygiene', label: 'Hygiene', max: 10, hasTarget: false, unit: 'months' },
  { key: 'leadership', label: 'Leadership', max: 10, hasTarget: false, unit: 'score' },
]

const HYGIENE_OPTIONS = [
  { value: 18, label: '18 months' },
  { value: 12, label: '12 months' },
  { value: 6, label: '6 months' },
]

const LEADERSHIP_OPTIONS = [0, 1, 2, 3, 4, 5]

const EMPTY_FORM = {
  period_type: 'H1',
  year: new Date().getFullYear(),
  manager_type: 'NON_EQUITY',
  // Basic Info
  net_profit: '',
  account_split: '',
  cash_split: '',
  incentive_amount: '',
  incentive_percent: '',
  equity_share_percent: '',
  staff_count: '',
  staff_incentive_percent: '',
  guarantee_percent: '',
  guarantee_amount: '',
  // Evaluation scores
  sales_target: '',
  sales_achievement: '',
  sales_score: '',
  cogs_target: '',
  cogs_achievement: '',
  cogs_score: '',
  wage_target: '',
  wage_achievement: '',
  wage_score: '',
  service_achievement: '',
  service_score: '',
  hygiene_achievement: '18',
  hygiene_score: '',
  leadership_achievement: '5',
  leadership_score: '',
}

export default function StoreEvaluation() {
  const { user } = useAuth()
  const { stores, selectedStore } = useStore()
  const [year, setYear] = useState(new Date().getFullYear())
  // H1=Apr-Sep, H2=Oct-Mar
  const currentMonth = new Date().getMonth() + 1
  const [periodType, setPeriodType] = useState(currentMonth >= 4 && currentMonth <= 9 ? 'H1' : 'H2')
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [evaluationId, setEvaluationId] = useState(null)
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [autoFilling, setAutoFilling] = useState(false)

  const isCEO = user?.role === 'CEO' || user?.role === 'HQ'

  // Load evaluation when store/year/period changes
  useEffect(() => {
    loadEvaluation()
  }, [selectedStore?.id, year, periodType])

  const loadEvaluation = async () => {
    if (!selectedStore?.id) return
    setLoading(true)
    setError('')
    try {
      const res = await evaluationAPI.list({
        store_id: selectedStore.id,
        year,
        period_type: periodType,
      })
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      if (data.length > 0) {
        const eval_ = data[0]
        setEvaluationId(eval_.id)
        setIsLocked(eval_.is_locked || false)
        setForm({
          period_type: eval_.period_type || periodType,
          year: eval_.year || year,
          manager_type: eval_.manager_type || 'NON_EQUITY',
          net_profit: eval_.net_profit || '',
          account_split: eval_.account_split || '',
          cash_split: eval_.cash_split || '',
          incentive_amount: eval_.incentive_amount || '',
          incentive_percent: eval_.incentive_percent || '',
          equity_share_percent: eval_.equity_share_percent || '',
          staff_count: eval_.staff_count || '',
          staff_incentive_percent: eval_.staff_incentive_percent || '',
          guarantee_percent: eval_.guarantee_percent || '',
          guarantee_amount: eval_.guarantee_amount || '',
          sales_target: eval_.sales_target || '',
          sales_achievement: eval_.sales_achievement || '',
          sales_score: eval_.sales_score || '',
          cogs_target: eval_.cogs_target || '',
          cogs_achievement: eval_.cogs_achievement || '',
          cogs_score: eval_.cogs_score || '',
          wage_target: eval_.wage_target || '',
          wage_achievement: eval_.wage_achievement || '',
          wage_score: eval_.wage_score || '',
          service_achievement: eval_.service_achievement || '',
          service_score: eval_.service_score || '',
          hygiene_achievement: eval_.hygiene_achievement || '18',
          hygiene_score: eval_.hygiene_score || '',
          leadership_achievement: eval_.leadership_achievement || '5',
          leadership_score: eval_.leadership_score || '',
        })
      } else {
        setEvaluationId(null)
        setIsLocked(false)
        setForm({ ...EMPTY_FORM, year, period_type: periodType })
      }
    } catch {
      setEvaluationId(null)
      setIsLocked(false)
      setForm({ ...EMPTY_FORM, year, period_type: periodType })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    if (isLocked) return
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Auto-calculated values
  const incentivePool = useMemo(() => {
    const amount = parseFloat(form.incentive_amount) || 0
    const percent = parseFloat(form.incentive_percent) || 0
    if (amount > 0) return amount
    const profit = parseFloat(form.net_profit) || 0
    return profit * (percent / 100)
  }, [form.net_profit, form.incentive_amount, form.incentive_percent])

  const totalScore = useMemo(() => {
    return SCORE_CONFIG.reduce((sum, cfg) => {
      const score = parseFloat(form[`${cfg.key}_score`]) || 0
      return sum + score
    }, 0)
  }, [form])

  const maxScore = useMemo(() => {
    return SCORE_CONFIG.reduce((sum, cfg) => sum + cfg.max, 0)
  }, [])

  const payoutRatio = totalScore / maxScore
  const finalPayout = incentivePool * payoutRatio

  const staffShare = useMemo(() => {
    const staffPct = parseFloat(form.staff_incentive_percent) || 0
    const staffCount = parseInt(form.staff_count) || 0
    const totalStaff = finalPayout * (staffPct / 100)
    const perStaff = staffCount > 0 ? totalStaff / staffCount : 0
    return { total: totalStaff, perStaff, count: staffCount }
  }, [finalPayout, form.staff_incentive_percent, form.staff_count])

  const handleAutoFill = async () => {
    if (!selectedStore?.id) return
    setAutoFilling(true)
    setError('')
    try {
      const res = await evaluationAPI.autoFill(year, periodType, selectedStore.id)
      const data = res.data
      setForm(prev => ({
        ...prev,
        sales_achievement: data.total_sales || prev.sales_achievement,
        cogs_achievement: data.cogs_percent || prev.cogs_achievement,
        wage_achievement: data.wage_percent || prev.wage_achievement,
        net_profit: data.net_profit || prev.net_profit,
      }))
      setSuccess('Auto-filled from Sky Report data')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to auto-fill. Make sure Sky Report data exists for this period.')
    } finally {
      setAutoFilling(false)
    }
  }

  const handleSave = async () => {
    if (isLocked) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        ...form,
        year,
        period_type: periodType,
        store: selectedStore?.id,
      }
      if (evaluationId) {
        await evaluationAPI.update(evaluationId, payload)
      } else {
        const res = await evaluationAPI.create(payload)
        setEvaluationId(res.data.id)
      }
      setSuccess('Evaluation saved successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save evaluation')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!evaluationId || isLocked) return
    if (!window.confirm('Are you sure you want to delete this evaluation?')) return
    setSaving(true)
    setError('')
    try {
      await evaluationAPI.delete(evaluationId)
      setEvaluationId(null)
      setForm({ ...EMPTY_FORM, year, period_type: periodType })
      setSuccess('Evaluation deleted')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to delete evaluation')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleLock = async () => {
    if (!evaluationId || !isCEO) return
    try {
      const res = await evaluationAPI.toggleLock(evaluationId)
      setIsLocked(res.data.is_locked)
      setSuccess(res.data.is_locked ? 'Evaluation locked' : 'Evaluation unlocked')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to toggle lock')
    }
  }

  const disabled = isLocked || loading

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Store Evaluation"
        icon={<ClipboardIcon size={24} />}
        subtitle={`${periodType === 'H1' ? 'Apr - Sep' : 'Oct - Mar'} ${year}`}
        action={
          isLocked && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 text-sm font-medium rounded-full">
              Locked
            </span>
          )
        }
      />

      {/* Period Selector */}
      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            {/* Year navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setYear(y => y - 1)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span className="text-lg font-bold text-gray-900 min-w-[4rem] text-center">{year}</span>
              <button
                onClick={() => setYear(y => y + 1)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            {/* Period toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              {['H1', 'H2'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodType(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    periodType === p
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p} ({p === 'H1' ? 'Apr-Sep' : 'Oct-Mar'})
                </button>
              ))}
            </div>

            {/* Store selector (CEO only) */}
            {isCEO && stores.length > 1 && (
              <div className="ml-auto">
                <select
                  value={selectedStore?.id || ''}
                  onChange={() => {}}
                  disabled
                  className={selectCls + ' min-w-[180px] opacity-60'}
                  title="Use sidebar store selector"
                >
                  <option>{selectedStore?.name || 'Select store'}</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Use sidebar to switch stores</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Manager Type Toggle */}
          <Card className="mb-4">
            <CardBody>
              <label className={labelCls}>Manager Type</label>
              <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
                {[
                  { value: 'NON_EQUITY', label: 'Non-Equity' },
                  { value: 'EQUITY', label: 'Equity' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleChange('manager_type', opt.value)}
                    disabled={disabled}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      form.manager_type === opt.value
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Basic Info Card */}
          <Card className="mb-4">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            </CardHeader>
            <CardBody className="border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Net Profit */}
                <div>
                  <label className={labelCls}>Net Profit ($)</label>
                  <input
                    type="number"
                    value={form.net_profit}
                    onChange={e => handleChange('net_profit', e.target.value)}
                    disabled={disabled}
                    className={disabled ? readOnlyCls : inputCls}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Account Split ($)</label>
                  <input
                    type="number"
                    value={form.account_split}
                    onChange={e => handleChange('account_split', e.target.value)}
                    disabled={disabled}
                    className={disabled ? readOnlyCls : inputCls}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Cash Split ($)</label>
                  <input
                    type="number"
                    value={form.cash_split}
                    onChange={e => handleChange('cash_split', e.target.value)}
                    disabled={disabled}
                    className={disabled ? readOnlyCls : inputCls}
                    placeholder="0.00"
                  />
                </div>

                {/* Incentive */}
                <div>
                  <label className={labelCls}>Incentive Amount ($)</label>
                  <input
                    type="number"
                    value={form.incentive_amount}
                    onChange={e => handleChange('incentive_amount', e.target.value)}
                    disabled={disabled}
                    className={disabled ? readOnlyCls : inputCls}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Incentive %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.incentive_percent}
                    onChange={e => handleChange('incentive_percent', e.target.value)}
                    disabled={disabled}
                    className={disabled ? readOnlyCls : inputCls}
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className={labelCls}>Incentive Pool ($)</label>
                  <input
                    type="text"
                    value={incentivePool > 0 ? fmt(incentivePool) : '-'}
                    readOnly
                    className={readOnlyCls}
                  />
                  <p className="text-xs text-gray-400 mt-1">Auto-calculated</p>
                </div>

                {/* Equity Share (only for Equity managers) */}
                {form.manager_type === 'EQUITY' && (
                  <div>
                    <label className={labelCls}>Equity Share %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.equity_share_percent}
                      onChange={e => handleChange('equity_share_percent', e.target.value)}
                      disabled={disabled}
                      className={disabled ? readOnlyCls : inputCls}
                      placeholder="0.0"
                    />
                  </div>
                )}

                {/* Staff */}
                <div>
                  <label className={labelCls}>Staff Count</label>
                  <input
                    type="number"
                    value={form.staff_count}
                    onChange={e => handleChange('staff_count', e.target.value)}
                    disabled={disabled}
                    className={disabled ? readOnlyCls : inputCls}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelCls}>Staff Incentive %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.staff_incentive_percent}
                    onChange={e => handleChange('staff_incentive_percent', e.target.value)}
                    disabled={disabled}
                    className={disabled ? readOnlyCls : inputCls}
                    placeholder="0.0"
                  />
                </div>

                {/* Guarantee (Non-Equity only) */}
                {form.manager_type === 'NON_EQUITY' && (
                  <>
                    <div>
                      <label className={labelCls}>Guarantee %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.guarantee_percent}
                        onChange={e => handleChange('guarantee_percent', e.target.value)}
                        disabled={disabled}
                        className={disabled ? readOnlyCls : inputCls}
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Guarantee Amount ($)</label>
                      <input
                        type="number"
                        value={form.guarantee_amount}
                        onChange={e => handleChange('guarantee_amount', e.target.value)}
                        disabled={disabled}
                        className={disabled ? readOnlyCls : inputCls}
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Evaluation Card */}
          <Card className="mb-4">
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Evaluation</h2>
              <button
                onClick={handleAutoFill}
                disabled={disabled || autoFilling}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {autoFilling ? 'Loading...' : 'Auto-fill from Sky Report'}
              </button>
            </CardHeader>
            <CardBody className="border-t border-gray-100">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-12 gap-2 mb-2 px-1">
                <div className="col-span-1 text-xs text-gray-400 font-medium">#</div>
                <div className="col-span-2 text-xs text-gray-400 font-medium">Category</div>
                <div className="col-span-3 text-xs text-gray-400 font-medium text-right">Target</div>
                <div className="col-span-3 text-xs text-gray-400 font-medium text-right">Achievement</div>
                <div className="col-span-2 text-xs text-gray-400 font-medium text-right">Score</div>
                <div className="col-span-1 text-xs text-gray-400 font-medium text-right">Max</div>
              </div>

              <div className="space-y-2">
                {SCORE_CONFIG.map((cfg, idx) => (
                  <div
                    key={cfg.key}
                    className="grid grid-cols-12 gap-2 items-center py-2 px-1 rounded-lg hover:bg-gray-50"
                  >
                    {/* # */}
                    <div className="col-span-1 text-sm font-medium text-gray-500">{idx + 1}</div>

                    {/* Category */}
                    <div className="col-span-2 text-sm font-medium text-gray-900">{cfg.label}</div>

                    {/* Target */}
                    <div className="col-span-3">
                      {cfg.hasTarget ? (
                        <input
                          type="number"
                          step={cfg.unit === '$' ? '1' : '0.1'}
                          value={form[`${cfg.key}_target`]}
                          onChange={e => handleChange(`${cfg.key}_target`, e.target.value)}
                          disabled={disabled}
                          className={disabled ? readOnlyCls : inputCls}
                          placeholder={cfg.unit === '$' ? '$0' : '0%'}
                        />
                      ) : (
                        <div className={readOnlyCls}>-</div>
                      )}
                    </div>

                    {/* Achievement */}
                    <div className="col-span-3">
                      {cfg.key === 'hygiene' ? (
                        <select
                          value={form.hygiene_achievement}
                          onChange={e => handleChange('hygiene_achievement', e.target.value)}
                          disabled={disabled}
                          className={disabled ? readOnlyCls : selectCls + ' text-right'}
                        >
                          {HYGIENE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : cfg.key === 'leadership' ? (
                        <select
                          value={form.leadership_achievement}
                          onChange={e => handleChange('leadership_achievement', e.target.value)}
                          disabled={disabled}
                          className={disabled ? readOnlyCls : selectCls + ' text-right'}
                        >
                          {LEADERSHIP_OPTIONS.map(v => (
                            <option key={v} value={v}>{v}/5</option>
                          ))}
                        </select>
                      ) : cfg.key === 'service' ? (
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={form.service_achievement}
                          onChange={e => handleChange('service_achievement', e.target.value)}
                          disabled={disabled}
                          className={disabled ? readOnlyCls : inputCls}
                          placeholder="0.0"
                        />
                      ) : (
                        <input
                          type="number"
                          step={cfg.unit === '$' ? '1' : '0.1'}
                          value={form[`${cfg.key}_achievement`]}
                          onChange={e => handleChange(`${cfg.key}_achievement`, e.target.value)}
                          disabled={disabled}
                          className={disabled ? readOnlyCls : inputCls}
                          placeholder={cfg.unit === '$' ? '$0' : '0%'}
                        />
                      )}
                    </div>

                    {/* Score */}
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={cfg.max}
                        value={form[`${cfg.key}_score`]}
                        onChange={e => handleChange(`${cfg.key}_score`, e.target.value)}
                        disabled={disabled}
                        className={disabled ? readOnlyCls : inputCls}
                        placeholder="0"
                      />
                    </div>

                    {/* Max */}
                    <div className="col-span-1 text-sm text-gray-400 text-right font-medium">{cfg.max}</div>
                  </div>
                ))}

                {/* Total row */}
                <div className="grid grid-cols-12 gap-2 items-center py-3 px-1 border-t border-gray-200 bg-gray-50 rounded-lg mt-2">
                  <div className="col-span-1" />
                  <div className="col-span-2 text-sm font-bold text-gray-900">Total</div>
                  <div className="col-span-3" />
                  <div className="col-span-3" />
                  <div className="col-span-2 text-right text-sm font-bold text-gray-900">{totalScore}</div>
                  <div className="col-span-1 text-right text-sm font-bold text-gray-400">{maxScore}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Result Card */}
          <Card className="mb-4">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Result</h2>
            </CardHeader>
            <CardBody className="border-t border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Score</p>
                  <p className="text-2xl font-bold text-gray-900">{totalScore}<span className="text-sm text-gray-400">/{maxScore}</span></p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-blue-600 mb-1">Payout Ratio</p>
                  <p className="text-2xl font-bold text-blue-700">{(payoutRatio * 100).toFixed(0)}%</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Incentive Pool</p>
                  <p className="text-2xl font-bold text-gray-900">${fmt(incentivePool)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-green-600 mb-1">Final Payout</p>
                  <p className="text-2xl font-bold text-green-700">${fmt(finalPayout)}</p>
                </div>
              </div>

              {/* Staff share breakdown */}
              {staffShare.count > 0 && parseFloat(form.staff_incentive_percent) > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-2">Staff Incentive Breakdown</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Staff Pool:</span>{' '}
                      <span className="font-semibold">${fmt(staffShare.total)}</span>
                      <span className="text-gray-400 ml-1">({form.staff_incentive_percent}% of payout)</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Per Staff:</span>{' '}
                      <span className="font-semibold">${fmt(staffShare.perStaff)}</span>
                      <span className="text-gray-400 ml-1">({staffShare.count} staff)</span>
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            {/* Lock/Unlock (CEO only) */}
            {isCEO && evaluationId && (
              <button
                onClick={handleToggleLock}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isLocked
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {isLocked ? 'Unlock' : 'Lock'}
              </button>
            )}

            <div className="flex-1" />

            {/* Delete */}
            {evaluationId && !isLocked && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50"
              >
                Delete
              </button>
            )}

            {/* Save */}
            {!isLocked && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

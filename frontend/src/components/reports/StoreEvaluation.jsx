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
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const isCEO = user?.role === 'CEO' || user?.role === 'HQ'

  // Load evaluation when store/year/period changes
  useEffect(() => {
    loadEvaluation()
  }, [selectedStore?.id, year, periodType])

  // Load history when store changes
  useEffect(() => {
    loadHistory()
  }, [selectedStore?.id])

  const loadHistory = async () => {
    if (!selectedStore?.id) return
    setHistoryLoading(true)
    try {
      const res = await evaluationAPI.history(selectedStore.id)
      setHistory(res.data || [])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

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
          sales_target: eval_.sales_target || '',
          sales_achievement: eval_.sales_achievement || '',
          sales_score: eval_.sales_score || '',
          cogs_target: eval_.cogs_target || '',
          cogs_achievement: eval_.cogs_achievement || '',
          cogs_score: eval_.cogs_score || '',
          wage_target: eval_.wage_target || '',
          wage_achievement: eval_.wage_achievement || '',
          wage_score: eval_.wage_score || '',
          service_achievement: eval_.service_achievement || eval_.service_rating || '',
          service_score: eval_.service_score || '',
          hygiene_achievement: eval_.hygiene_achievement || eval_.hygiene_months || '18',
          hygiene_score: eval_.hygiene_score || '',
          leadership_achievement: eval_.leadership_achievement || eval_.leadership_score || '5',
          leadership_score: eval_.leadership_score_points || eval_.leadership_score || '',
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

  // Auto-calculate score based on achievement vs target
  const calcScore = (key, updatedForm) => {
    const target = parseFloat(updatedForm[`${key}_target`]) || 0
    const achievement = parseFloat(updatedForm[`${key}_achievement`]) || 0

    if (key === 'sales') {
      // Sales (25pts): 110%+ = 25, 100-109% = 15, 90-99% = 10, 80-89% = 0, <80% = 0
      if (target <= 0) return 0
      const ratio = achievement / target
      if (ratio >= 1.1) return 25
      if (ratio >= 1.0) return 15
      if (ratio >= 0.9) return 10
      return 0
    }
    if (key === 'cogs') {
      // COGS (20pts): at/below target = 20, +1%p = 18, +2%p = 14, +3%p+ = 7
      const diff = achievement - target  // both in percentage points (e.g. 33.5 - 33.0 = 0.5)
      if (diff <= 0) return 20
      if (diff <= 1) return 18
      if (diff <= 2) return 14
      return 7
    }
    if (key === 'wage') {
      // Wage (25pts): at/below target = 25, +1%p = 15, +2%p = 10, +3%p+ = 0
      const diff = achievement - target  // both in percentage points
      if (diff <= 0) return 25
      if (diff <= 1) return 15
      if (diff <= 2) return 10
      return 0
    }
    if (key === 'service') {
      // Service (10pts): 4.8+ = 10, 4.5-4.7 = 7, 4.2-4.4 = 5, 4.0-4.1 = 0, <4.0 = 0
      if (achievement >= 4.8) return 10
      if (achievement >= 4.5) return 7
      if (achievement >= 4.2) return 5
      return 0
    }
    if (key === 'hygiene') {
      // Hygiene (10pts): 18mo = 10, 12mo = 5, 6mo = 0
      if (achievement >= 18) return 10
      if (achievement >= 12) return 5
      return 0
    }
    if (key === 'leadership') {
      // Leadership (10pts): 5 = 10, 4 = 5, 3 = 2, <=2 = 0
      if (achievement >= 5) return 10
      if (achievement >= 4) return 5
      if (achievement >= 3) return 2
      return 0
    }
    return 0
  }

  const handleChange = (field, value) => {
    if (isLocked) return
    setForm(prev => {
      const updated = { ...prev, [field]: value }
      // Auto-calculate scores when target or achievement changes
      for (const cfg of SCORE_CONFIG) {
        if (field === `${cfg.key}_target` || field === `${cfg.key}_achievement`) {
          updated[`${cfg.key}_score`] = calcScore(cfg.key, updated)
        }
      }
      return updated
    })
  }

  const totalScore = useMemo(() => {
    return SCORE_CONFIG.reduce((sum, cfg) => {
      const score = parseFloat(form[`${cfg.key}_score`]) || 0
      return sum + score
    }, 0)
  }, [form])

  const maxScore = useMemo(() => {
    return SCORE_CONFIG.reduce((sum, cfg) => sum + cfg.max, 0)
  }, [])

  const handleAutoFill = async () => {
    if (!selectedStore?.id) return
    setAutoFilling(true)
    setError('')
    try {
      const res = await evaluationAPI.autoFill(year, periodType, selectedStore.id)
      const data = res.data
      // Backend returns decimals (e.g. 0.335), convert to percentage (33.5)
      const cogsVal = data.cogs_percent ? (parseFloat(data.cogs_percent) * 100).toFixed(1) : null
      const wageVal = data.wage_percent ? (parseFloat(data.wage_percent) * 100).toFixed(1) : null
      // Targets from Sky Report goals
      const salesTarget = data.sales_goal_total || null
      const cogsTarget = data.cogs_goal_avg || null
      const wageTarget = data.wage_goal_avg || null

      setForm(prev => {
        const updated = {
          ...prev,
          // Targets (from Sky Report goals)
          sales_target: salesTarget || prev.sales_target,
          cogs_target: cogsTarget || prev.cogs_target,
          wage_target: wageTarget || prev.wage_target,
          // Achievements (from Sky Report actuals)
          sales_achievement: data.total_sales || prev.sales_achievement,
          cogs_achievement: cogsVal || prev.cogs_achievement,
          wage_achievement: wageVal || prev.wage_achievement,
          service_achievement: data.service_rating || prev.service_achievement,
        }
        // Auto-calculate scores for filled fields
        for (const cfg of SCORE_CONFIG) {
          if (cfg.hasTarget || cfg.key === 'service') {
            updated[`${cfg.key}_score`] = calcScore(cfg.key, updated)
          }
        }
        return updated
      })
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
        // Map frontend fields to backend model fields
        service_rating: form.service_achievement || 0,
        hygiene_months: form.hygiene_achievement || 0,
        leadership_score: form.leadership_achievement || 0,
      }
      if (evaluationId) {
        await evaluationAPI.update(evaluationId, payload)
      } else {
        const res = await evaluationAPI.create(payload)
        setEvaluationId(res.data.id)
      }
      setSuccess('Evaluation saved successfully')
      setTimeout(() => setSuccess(''), 3000)
      loadEvaluation()
      loadHistory()
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
      loadHistory()
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
      loadHistory()
    } catch (err) {
      setError('Failed to toggle lock')
    }
  }

  const navigateToPeriod = (h) => {
    setYear(h.year)
    setPeriodType(h.period_type)
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

      {/* History Table */}
      {history.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Past Evaluations</h2>
          </CardHeader>
          <CardBody className="border-t border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Period</th>
                    <th className="text-right pb-2 font-medium">Total</th>
                    <th className="text-right pb-2 font-medium">Sales</th>
                    <th className="text-right pb-2 font-medium">COGS</th>
                    <th className="text-right pb-2 font-medium">Wage</th>
                    <th className="text-right pb-2 font-medium">Service</th>
                    <th className="text-right pb-2 font-medium">Hygiene</th>
                    <th className="text-right pb-2 font-medium">Leader</th>
                    <th className="text-center pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {history.map(h => {
                    const isCurrent = h.year === year && h.period_type === periodType
                    return (
                      <tr
                        key={h.id}
                        onClick={() => navigateToPeriod(h)}
                        className={`cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${isCurrent ? 'bg-blue-50' : ''}`}
                      >
                        <td className={`py-2 ${isCurrent ? 'font-semibold text-blue-600' : ''}`}>
                          {h.year} {h.period_type}
                        </td>
                        <td className="py-2 text-right font-semibold">{h.total_score}/100</td>
                        <td className="py-2 text-right">{h.sales_score}</td>
                        <td className="py-2 text-right">{h.cogs_score}</td>
                        <td className="py-2 text-right">{h.wage_score}</td>
                        <td className="py-2 text-right">{h.service_score}</td>
                        <td className="py-2 text-right">{h.hygiene_score}</td>
                        <td className="py-2 text-right">{h.leadership_score_points}</td>
                        <td className="py-2 text-center">{h.is_locked ? 'Locked' : 'Open'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <>
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

          {/* Total Score Display */}
          <Card className="mb-4">
            <CardBody>
              <div className="flex items-center justify-center gap-6">
                <div className="bg-gray-50 rounded-xl p-6 text-center flex-1">
                  <p className="text-xs text-gray-500 mb-1">Total Score</p>
                  <p className="text-3xl font-bold text-gray-900">{totalScore}<span className="text-lg text-gray-400">/{maxScore}</span></p>
                </div>
                <div className="bg-blue-50 rounded-xl p-6 text-center flex-1">
                  <p className="text-xs text-blue-600 mb-1">Score Percentage</p>
                  <p className="text-3xl font-bold text-blue-700">{maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(0) : 0}%</p>
                </div>
              </div>
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

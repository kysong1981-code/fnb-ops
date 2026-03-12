import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { closingAPI, storeAPI, supplierCostAPI, otherSalesAPI, hrCashAPI } from '../../services/api'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'
import { PlusIcon, TrashIcon, CheckCircleIcon, ArrowRightIcon } from '../icons'

const MANAGER_ROLES = ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']

export default function DailyClosingForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const isManager = user && MANAGER_ROLES.includes(user.role)

  // If date param provided (from dashboard approval), use it; otherwise today
  const dateParam = searchParams.get('date')
  const todayStr = new Date().toISOString().split('T')[0]
  const [closingDate] = useState(dateParam || todayStr)

  const [closingId, setClosingId] = useState(null)
  const [closingStatus, setClosingStatus] = useState(null)

  // Edit mode: manager can unlock submitted/approved entries
  const [editMode, setEditMode] = useState(false)

  // POS
  const [posCard, setPosCard] = useState('')
  const [posCash, setPosCash] = useState('')
  const [tabCount, setTabCount] = useState('')

  // Actual
  const [actualCard, setActualCard] = useState('')
  const [actualCash, setActualCash] = useState('')

  // Variance note
  const [varianceNote, setVarianceNote] = useState('')

  // HR Cash
  const [hrCashAmount, setHrCashAmount] = useState('')
  const [hrCashEntryId, setHrCashEntryId] = useState(null)
  const [hrCashEnabled, setHrCashEnabled] = useState(false)

  // Other Sales
  const [salesCategories, setSalesCategories] = useState([])
  const [otherSaleAmounts, setOtherSaleAmounts] = useState({})
  const [existingOtherSales, setExistingOtherSales] = useState([])

  // Supplier costs (Today's Invoices)
  const [suppliers, setSuppliers] = useState([])
  const [supplierCosts, setSupplierCosts] = useState([])
  const [invoiceAmounts, setInvoiceAmounts] = useState({})

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Computed
  const posTotal = (parseFloat(posCard) || 0) + (parseFloat(posCash) || 0)
  const actualTotal = (parseFloat(actualCard) || 0) + (parseFloat(actualCash) || 0)
  const cardVariance = (parseFloat(actualCard) || 0) - (parseFloat(posCard) || 0)
  const cashVariance = (parseFloat(actualCash) || 0) - (parseFloat(posCash) || 0)
  const totalVariance = cardVariance + cashVariance
  const hasVariance = totalVariance !== 0

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Read-only logic
  const isReadOnly = (() => {
    if (!closingId) return false
    if (closingStatus === 'DRAFT') return false
    if (isManager && editMode) return false
    return true
  })()

  // Can manager enable edit?
  const canEdit = closingId && isManager && !editMode && (closingStatus === 'SUBMITTED' || closingStatus === 'APPROVED')

  // Load suppliers + sales categories
  useEffect(() => {
    storeAPI.getSuppliers().then(res => {
      setSuppliers((res.data.results || res.data || []).filter(s => s.is_active))
    }).catch(() => {})

    storeAPI.getSalesCategories().then(res => {
      setSalesCategories((res.data.results || res.data || []).filter(c => c.is_active))
    }).catch(() => {})
  }, [])

  // Check if closing exists for selected date
  useEffect(() => {
    setEditMode(false)
    const checkExisting = async () => {
      try {
        const res = await closingAPI.getByDate(closingDate)
        const data = res.data.results || res.data || []
        if (data.length > 0) {
          // Fetch full detail (list endpoint doesn't include pos_card, pos_cash, etc.)
          const detailRes = await closingAPI.get(data[0].id)
          const c = detailRes.data
          setClosingId(c.id)
          setClosingStatus(c.status)
          setPosCard(c.pos_card || '')
          setPosCash(c.pos_cash || '')
          setTabCount(c.tab_count || '')
          setActualCard(c.actual_card || '')
          setActualCash(c.actual_cash || '')
          setVarianceNote(c.variance_note || '')
          setHrCashEnabled(c.hr_cash_enabled || false)
          const hrEntries = c.hr_cash_entries || []
          if (hrEntries.length > 0) {
            setHrCashAmount(hrEntries[0].amount || '')
            setHrCashEntryId(hrEntries[0].id)
          } else {
            setHrCashAmount('')
            setHrCashEntryId(null)
          }
        } else {
          setClosingId(null)
          setClosingStatus(null)
          setPosCard('')
          setPosCash('')
          setTabCount('')
          setActualCard('')
          setActualCash('')
          setVarianceNote('')
          setHrCashAmount('')
          setHrCashEntryId(null)
          setSupplierCosts([])
          setExistingOtherSales([])
          setOtherSaleAmounts({})
        }
      } catch {
        // ignore
      }
    }
    checkExisting()
  }, [closingDate])

  // Load supplier costs + other sales when closingId changes
  useEffect(() => {
    if (closingId) {
      supplierCostAPI.list(closingId).then(res => {
        setSupplierCosts(res.data.results || res.data || [])
      }).catch(() => {})

      otherSalesAPI.list(closingId).then(res => {
        const items = res.data.results || res.data || []
        setExistingOtherSales(items)
        const amounts = {}
        items.forEach(s => { amounts[s.name] = String(s.amount) })
        setOtherSaleAmounts(amounts)
      }).catch(() => {})
    }
  }, [closingId])

  const showMsg = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // Sync other sales
  const syncOtherSales = async (cId) => {
    for (const s of existingOtherSales) {
      try { await otherSalesAPI.delete(s.id) } catch { /* ignore */ }
    }
    for (const [name, amount] of Object.entries(otherSaleAmounts)) {
      const val = parseFloat(amount)
      if (val && val > 0) {
        try { await otherSalesAPI.create({ closing: cId, name, amount: val }) } catch { /* ignore */ }
      }
    }
    try {
      const res = await otherSalesAPI.list(cId)
      setExistingOtherSales(res.data.results || res.data || [])
    } catch { /* ignore */ }
  }

  // Sync HR Cash
  const syncHrCash = async (cId) => {
    const val = parseFloat(hrCashAmount)
    if (val && val > 0) {
      const formData = new FormData()
      formData.append('daily_closing', cId)
      formData.append('amount', val)
      if (hrCashEntryId) {
        await hrCashAPI.update(hrCashEntryId, formData)
      } else {
        const res = await hrCashAPI.create(formData)
        setHrCashEntryId(res.data.id)
      }
    } else if (hrCashEntryId) {
      await hrCashAPI.delete(hrCashEntryId)
      setHrCashEntryId(null)
    }
  }

  // Ensure closing exists (auto-create for mid-shift invoice add)
  const ensureClosing = async () => {
    if (closingId) return closingId
    try {
      const res = await closingAPI.create({
        organization: user?.organization,
        closing_date: closingDate,
        pos_card: posCard || 0,
        pos_cash: posCash || 0,
        tab_count: tabCount || 0,
        actual_card: actualCard || 0,
        actual_cash: actualCash || 0,
      })
      setClosingId(res.data.id)
      setClosingStatus(res.data.status)
      setHrCashEnabled(res.data.hr_cash_enabled || false)
      return res.data.id
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.closing_date?.[0] || 'Failed to create closing')
      return null
    }
  }

  // Save (create or update) + Submit
  const handleSave = async () => {
    // Variance note required if there's a variance
    if (hasVariance && !varianceNote.trim()) {
      setError('Please enter a reason for the variance before submitting.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        organization: user?.organization,
        closing_date: closingDate,
        pos_card: posCard || 0,
        pos_cash: posCash || 0,
        tab_count: tabCount || 0,
        actual_card: actualCard || 0,
        actual_cash: actualCash || 0,
        variance_note: varianceNote || '',
      }

      let cId = closingId
      if (closingId) {
        const res = await closingAPI.update(closingId, payload)
        setClosingStatus(res.data.status)
      } else {
        const res = await closingAPI.create(payload)
        cId = res.data.id
        setClosingId(cId)
        setClosingStatus(res.data.status)
      }

      // Sync other sales + HR cash
      await syncOtherSales(cId)
      await syncHrCash(cId)

      // Submit if still draft
      if (!closingStatus || closingStatus === 'DRAFT') {
        try {
          const res = await closingAPI.submit(cId)
          setClosingStatus(res.data.status)
        } catch { /* ignore submit errors for re-save */ }
      }

      setEditMode(false)
      showMsg('Saved & Submitted successfully')
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.closing_date?.[0] || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Manager: Submit + Approve in one go
  const handleSubmitAndApprove = async () => {
    if (hasVariance && !varianceNote.trim()) {
      setError('Please enter a reason for the variance before submitting.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        organization: user?.organization,
        closing_date: closingDate,
        pos_card: posCard || 0,
        pos_cash: posCash || 0,
        tab_count: tabCount || 0,
        actual_card: actualCard || 0,
        actual_cash: actualCash || 0,
        variance_note: varianceNote || '',
      }

      let cId = closingId
      if (closingId) {
        await closingAPI.update(closingId, payload)
      } else {
        const res = await closingAPI.create(payload)
        cId = res.data.id
        setClosingId(cId)
      }

      // Sync other sales + HR cash
      await syncOtherSales(cId)
      await syncHrCash(cId)

      // Submit then approve
      try { await closingAPI.submit(cId) } catch { /* may already be submitted */ }
      const res = await closingAPI.approve(cId)
      setClosingStatus(res.data.status)

      setEditMode(false)
      showMsg('Submitted & Approved!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit & approve')
    } finally {
      setSaving(false)
    }
  }

  // Add invoice for a supplier
  const handleAddInvoice = async (supplierId) => {
    const amount = invoiceAmounts[supplierId]
    if (!amount) return

    setLoading(true)
    setError('')
    try {
      const cId = await ensureClosing()
      if (!cId) { setLoading(false); return }

      await supplierCostAPI.create({ closing: cId, supplier: supplierId, amount })
      setInvoiceAmounts(prev => ({ ...prev, [supplierId]: '' }))
      const res = await supplierCostAPI.list(cId)
      setSupplierCosts(res.data.results || res.data || [])
      showMsg('Invoice added')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add invoice')
    } finally {
      setLoading(false)
    }
  }

  // Approve (for manager reviewing employee submissions)
  const handleApprove = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await closingAPI.approve(closingId)
      setClosingStatus(res.data.status)
      showMsg('Approved!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to approve')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCost = async (id) => {
    try {
      await supplierCostAPI.delete(id)
      setSupplierCosts(prev => prev.filter(c => c.id !== id))
    } catch { setError('Failed to delete') }
  }

  const canApprove = closingId && isManager && closingStatus === 'SUBMITTED' && !editMode

  const statusBadge = {
    SUBMITTED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-green-100 text-green-700',
  }
  const statusLabel = { SUBMITTED: 'Submitted', APPROVED: 'Approved' }

  const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400'

  const supplierCostTotal = supplierCosts.reduce((s, c) => s + parseFloat(c.amount || 0), 0)
  const otherSaleTotal = Object.values(otherSaleAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  // Format date for display
  const displayDate = new Date(closingDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Daily Closing</h1>
          <p className="text-sm text-gray-400 mt-0.5">{displayDate}</p>
        </div>
        <div className="flex items-center gap-2">
          {closingId && closingStatus && statusLabel[closingStatus] && (
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusBadge[closingStatus]}`}>
              {statusLabel[closingStatus]}
            </span>
          )}
          {canEdit ? (
            <button
              onClick={() => setEditMode(true)}
              className="text-xs font-medium px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
            >
              Edit
            </button>
          ) : editMode ? (
            <button
              onClick={() => setEditMode(false)}
              className="text-xs font-medium px-3 py-1.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-400">POS Total</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{fmt(posTotal)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-400">Actual Total</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{fmt(actualTotal)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-400">Variance</p>
          <p className={`text-sm font-bold mt-0.5 ${totalVariance === 0 ? 'text-green-600' : Math.abs(totalVariance) > 10 ? 'text-red-600' : 'text-amber-600'}`}>
            {totalVariance >= 0 ? '+' : ''}{fmt(totalVariance)}
          </p>
        </Card>
      </div>

      {/* Messages */}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

      {/* ──────── POS ──────── */}
      <Card className="p-5">
        <SectionLabel>POS</SectionLabel>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Card</label>
            <input type="number" step="0.01" value={posCard} onChange={(e) => setPosCard(e.target.value)} disabled={isReadOnly} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cash</label>
            <input type="number" step="0.01" value={posCash} onChange={(e) => setPosCash(e.target.value)} disabled={isReadOnly} placeholder="0.00" className={inputCls} />
          </div>
        </div>
      </Card>

      {/* ──────── Actual ──────── */}
      <Card className="p-5">
        <SectionLabel>Actual</SectionLabel>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Card</label>
            <input type="number" step="0.01" value={actualCard} onChange={(e) => setActualCard(e.target.value)} disabled={isReadOnly} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cash</label>
            <input type="number" step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} disabled={isReadOnly} placeholder="0.00" className={inputCls} />
          </div>
        </div>
      </Card>

      {/* ──────── Variance ──────── */}
      <Card className={`p-5 ${totalVariance === 0 ? 'bg-green-50 border-green-200' : Math.abs(totalVariance) > 10 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 font-medium">Variance</p>
            <p className="text-xs text-gray-400 mt-0.5">Actual − POS</p>
          </div>
          <p className={`text-2xl font-bold ${totalVariance === 0 ? 'text-green-600' : Math.abs(totalVariance) > 10 ? 'text-red-600' : 'text-amber-600'}`}>
            {fmt(totalVariance)}
          </p>
        </div>
        <div className="space-y-1.5 pt-2 border-t border-black/5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Card</span>
            <span className={`text-xs font-semibold ${cardVariance === 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(cardVariance)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Cash</span>
            <span className={`text-xs font-semibold ${cashVariance === 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(cashVariance)}</span>
          </div>
        </div>

        {/* Variance Note - required when variance exists */}
        {hasVariance && (
          <div className="mt-3 pt-3 border-t border-black/5">
            <label className="text-xs text-gray-500 font-medium mb-1 block">
              Variance Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={varianceNote}
              onChange={(e) => setVarianceNote(e.target.value)}
              disabled={isReadOnly}
              placeholder="Please explain the reason for the variance..."
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
        )}
      </Card>

      {/* ──────── Tab Count ──────── */}
      <Card className="p-5">
        <SectionLabel>Tab Count</SectionLabel>
        <p className="text-xs text-gray-400 mb-2">Number of transactions today</p>
        <input type="number" step="1" value={tabCount} onChange={(e) => setTabCount(e.target.value)} disabled={isReadOnly} placeholder="0" className={inputCls} />
      </Card>

      {/* ──────── Other Sales ──────── */}
      {salesCategories.length > 0 && (
        <Card className="p-5">
          <SectionLabel>Other Sales</SectionLabel>
          <div className="space-y-3">
            {salesCategories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900 w-32 shrink-0 truncate">{cat.name}</span>
                <input
                  type="number" step="0.01"
                  value={otherSaleAmounts[cat.name] || ''}
                  onChange={(e) => setOtherSaleAmounts(prev => ({ ...prev, [cat.name]: e.target.value }))}
                  disabled={isReadOnly} placeholder="0.00" className={inputCls}
                />
              </div>
            ))}
          </div>
          {otherSaleTotal > 0 && (
            <div className="flex justify-end pt-3 mt-3 border-t border-gray-100">
              <span className="text-sm font-bold text-gray-700">Total: {fmt(otherSaleTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* ──────── Today's Invoices ──────── */}
      {suppliers.length > 0 && (
        <Card className="p-5">
          <SectionLabel>Today's Invoices</SectionLabel>
          <div className="space-y-3">
            {suppliers.map((sup) => {
              const entries = supplierCosts.filter(sc => sc.supplier === sup.id)
              return (
                <div key={sup.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-gray-50">
                    <span className="text-sm font-medium text-gray-900 w-32 shrink-0 truncate">{sup.name}</span>
                    {!isReadOnly && (
                      <>
                        <input
                          type="number" step="0.01"
                          value={invoiceAmounts[sup.id] || ''}
                          onChange={(e) => setInvoiceAmounts(prev => ({ ...prev, [sup.id]: e.target.value }))}
                          placeholder="0.00" className={inputCls}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddInvoice(sup.id) } }}
                        />
                        <button
                          onClick={() => handleAddInvoice(sup.id)}
                          disabled={loading || !invoiceAmounts[sup.id]}
                          className="shrink-0 flex items-center gap-1 px-3 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition"
                        >
                          <PlusIcon size={14} /> Add
                        </button>
                      </>
                    )}
                  </div>
                  {entries.length > 0 && (
                    <div className="px-3 pb-2">
                      {entries.map((sc) => (
                        <div key={sc.id} className="flex items-center justify-between py-1.5 pl-3">
                          <span className="text-xs text-gray-500">{fmt(sc.amount)}</span>
                          {!isReadOnly && (
                            <button onClick={() => handleDeleteCost(sc.id)} className="text-gray-300 hover:text-red-500 transition p-1">
                              <TrashIcon size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {entries.length > 1 && (
                        <div className="flex justify-end pt-1 border-t border-gray-100 mt-1">
                          <span className="text-xs font-semibold text-gray-600">
                            {fmt(entries.reduce((s, c) => s + parseFloat(c.amount || 0), 0))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {supplierCostTotal > 0 && (
            <div className="flex justify-end pt-3 mt-3 border-t border-gray-100">
              <span className="text-sm font-bold text-gray-700">Total: {fmt(supplierCostTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* ──────── HR Cash ──────── */}
      {hrCashEnabled && (
        <Card className="p-5">
          <SectionLabel>HR Cash</SectionLabel>
          <input type="number" step="0.01" value={hrCashAmount} onChange={(e) => setHrCashAmount(e.target.value)} disabled={isReadOnly} placeholder="0.00" className={inputCls} />
        </Card>
      )}

      {/* ──────── Actions ──────── */}
      <div className="space-y-3 pb-6">
        {/* Employee: Save & Submit */}
        {!isReadOnly && !isManager && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            <CheckCircleIcon size={18} />
            {saving ? 'Saving...' : 'Save & Submit'}
          </button>
        )}

        {/* Manager: Save Changes (edit mode) */}
        {!isReadOnly && isManager && editMode && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            <CheckCircleIcon size={18} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}

        {/* Manager: Submit only OR Submit & Approve (new entry or draft) */}
        {!isReadOnly && isManager && !editMode && (!closingId || closingStatus === 'DRAFT') && (
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
            >
              <CheckCircleIcon size={18} />
              {saving ? 'Saving...' : 'Submit'}
            </button>
            <button
              onClick={handleSubmitAndApprove}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <CheckCircleIcon size={18} />
              {saving ? 'Processing...' : 'Submit & Approve'}
            </button>
          </div>
        )}

        {/* Manager: Approve submitted entries */}
        {canApprove && (
          <button
            onClick={handleApprove}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <CheckCircleIcon size={18} />
            {saving ? 'Processing...' : 'Approve'}
          </button>
        )}

        {/* Back to Dashboard */}
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
        >
          Back to Dashboard
          <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  )
}

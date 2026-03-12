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

  const [closingDate, setClosingDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0])
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

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Read-only logic:
  // - No existing closing (new entry) → editable
  // - Existing + DRAFT → editable
  // - Existing + SUBMITTED/APPROVED → read-only unless manager enables edit mode
  const isReadOnly = (() => {
    if (!closingId) return false // New entry
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
          const c = data[0]
          setClosingId(c.id)
          setClosingStatus(c.status)
          setPosCard(c.pos_card || '')
          setPosCash(c.pos_cash || '')
          setTabCount(c.tab_count || '')
          setActualCard(c.actual_card || '')
          setActualCash(c.actual_cash || '')
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
      showMsg('Saved successfully')
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.closing_date?.[0] || 'Failed to save')
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

  // Approve
  const handleApprove = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await closingAPI.approve(closingId)
      setClosingStatus(res.data.status)
      showMsg('Approved')
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Daily Closing</h1>
          <p className="text-sm text-gray-400 mt-0.5">Record daily sales, invoices & cash up</p>
        </div>
        <div className="flex items-center gap-2">
          {closingId && closingStatus && statusLabel[closingStatus] && (
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusBadge[closingStatus]}`}>
              {statusLabel[closingStatus]}
            </span>
          )}
          {canEdit && (
            <button
              onClick={() => setEditMode(true)}
              className="text-xs font-medium px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

      {/* ──────── Closing Date ──────── */}
      <Card className="p-5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Closing Date</label>
        <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} disabled={closingId && isReadOnly} className={`${inputCls} mt-2`} />
      </Card>

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
        <div className="bg-blue-50 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-blue-600 font-medium">POS Total</span>
          <span className="text-sm font-bold text-blue-700">{fmt(posTotal)}</span>
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
        <div className="bg-blue-50 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-blue-600 font-medium">Actual Total</span>
          <span className="text-sm font-bold text-blue-700">{fmt(actualTotal)}</span>
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
        {!isReadOnly && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            <CheckCircleIcon size={18} />
            {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Save & Submit'}
          </button>
        )}

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

        {editMode && (
          <button
            onClick={() => setEditMode(false)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
          >
            Cancel Edit
          </button>
        )}

        <button
          onClick={() => navigate('/closing')}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
        >
          Back to List
          <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  )
}

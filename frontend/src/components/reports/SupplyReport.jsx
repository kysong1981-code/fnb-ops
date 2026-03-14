import { useState, useEffect } from 'react'
import { reportsAPI, supplierStatementAPI, monthlyCloseAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'
import Badge from '../ui/Badge'

const SENIOR_ROLES = ['SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN']

const VIEW_OPTIONS = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'daily', label: 'Daily' },
]

// Placeholder data for preview when API has no data
const PLACEHOLDER_MONTHLY = {
  period: 'monthly',
  month: '2026-03',
  grand_total: 15234.50,
  supplier_count: 5,
  suppliers: [
    { supplier_id: 1, supplier_name: 'Fresh Foods NZ', supplier_code: 'FFN', total: 5820.00, entry_count: 18, statement: { id: 1, statement_total: 5820.00, our_total: 5820.00, status: 'MATCHED', variance: 0 } },
    { supplier_id: 2, supplier_name: 'Bidvest', supplier_code: 'BID', total: 4250.00, entry_count: 12, statement: { id: 2, statement_total: 4380.00, our_total: 4250.00, status: 'MISMATCHED', variance: 130.00 } },
    { supplier_id: 3, supplier_name: 'Gilmours', supplier_code: 'GIL', total: 2890.50, entry_count: 8, statement: null },
    { supplier_id: 4, supplier_name: 'Service Foods', supplier_code: 'SRV', total: 1524.00, entry_count: 6, statement: null },
    { supplier_id: 5, supplier_name: 'Countdown Trade', supplier_code: 'CDT', total: 750.00, entry_count: 3, statement: { id: 3, statement_total: 750.00, our_total: 750.00, status: 'MATCHED', variance: 0 } },
  ],
}

// Placeholder drill-down detail for Bidvest (MISMATCHED supplier)
const PLACEHOLDER_DETAIL = {
  2: {
    supplier_id: 2,
    supplier_name: 'Bidvest',
    month: '2026-03',
    total: 4250.00,
    entry_count: 12,
    daily_entries: [
      { date: '2026-03-03', subtotal: 980.50, entries: [
        { id: 1, amount: 620.00, invoice_number: 'BV-20260303', description: 'Frozen items' },
        { id: 2, amount: 360.50, invoice_number: 'BV-20260303B', description: 'Packaging supplies' },
      ]},
      { date: '2026-03-07', subtotal: 1245.00, entries: [
        { id: 3, amount: 850.00, invoice_number: 'BV-20260307', description: 'Meat & poultry' },
        { id: 4, amount: 395.00, invoice_number: 'BV-20260307B', description: 'Cleaning supplies' },
      ]},
      { date: '2026-03-10', subtotal: 720.00, entries: [
        { id: 5, amount: 720.00, invoice_number: 'BV-20260310', description: 'Dairy products' },
      ]},
      { date: '2026-03-14', subtotal: 530.00, entries: [
        { id: 6, amount: 310.00, invoice_number: 'BV-20260314', description: 'Frozen vegetables' },
        { id: 7, amount: 220.00, invoice_number: 'BV-20260314B', description: 'Paper goods' },
      ]},
      { date: '2026-03-21', subtotal: 774.50, entries: [
        { id: 8, amount: 450.00, invoice_number: 'BV-20260321', description: 'Meat & poultry' },
        { id: 9, amount: 324.50, invoice_number: 'BV-20260321B', description: 'Condiments' },
      ]},
    ],
  },
  1: {
    supplier_id: 1,
    supplier_name: 'Fresh Foods NZ',
    month: '2026-03',
    total: 5820.00,
    entry_count: 18,
    daily_entries: [
      { date: '2026-03-01', subtotal: 850.00, entries: [
        { id: 10, amount: 520.00, invoice_number: 'INV-3401', description: 'Meat & poultry' },
        { id: 11, amount: 330.00, invoice_number: 'INV-3402', description: 'Dairy products' },
      ]},
      { date: '2026-03-05', subtotal: 1120.00, entries: [
        { id: 12, amount: 680.00, invoice_number: 'INV-3410', description: 'Fresh produce' },
        { id: 13, amount: 440.00, invoice_number: 'INV-3411', description: 'Seafood' },
      ]},
      { date: '2026-03-09', subtotal: 480.00, entries: [
        { id: 14, amount: 480.00, invoice_number: 'INV-3430', description: 'Fresh produce' },
      ]},
    ],
  },
}

const PLACEHOLDER_DAILY = {
  period: 'daily',
  grand_total: 3420.50,
  daily_reports: [
    {
      date: '2026-03-07', total: 1520.00,
      suppliers: [
        { supplier_id: 1, supplier_name: 'Fresh Foods NZ', subtotal: 850.00, entries: [
          { amount: 520.00, invoice_number: 'INV-3421', description: 'Meat & poultry' },
          { amount: 330.00, invoice_number: 'INV-3422', description: 'Dairy products' },
        ]},
        { supplier_id: 3, supplier_name: 'Gilmours', subtotal: 670.00, entries: [
          { amount: 670.00, invoice_number: 'GIL-8812', description: 'Dry goods & condiments' },
        ]},
      ],
    },
    {
      date: '2026-03-08', total: 980.50,
      suppliers: [
        { supplier_id: 2, supplier_name: 'Bidvest', subtotal: 980.50, entries: [
          { amount: 620.00, invoice_number: 'BV-20260308', description: 'Frozen items' },
          { amount: 360.50, invoice_number: 'BV-20260308B', description: 'Packaging' },
        ]},
      ],
    },
    {
      date: '2026-03-09', total: 920.00,
      suppliers: [
        { supplier_id: 1, supplier_name: 'Fresh Foods NZ', subtotal: 480.00, entries: [
          { amount: 480.00, invoice_number: 'INV-3430', description: 'Fresh produce' },
        ]},
        { supplier_id: 4, supplier_name: 'Service Foods', subtotal: 440.00, entries: [
          { amount: 440.00, invoice_number: 'SF-1192', description: 'Beverages' },
        ]},
      ],
    },
  ],
}

export default function SupplyReport() {
  const { user } = useAuth()
  const today = new Date()
  const [view, setView] = useState('monthly')
  const [month, setMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [isPlaceholder, setIsPlaceholder] = useState(false)

  // Monthly close state
  const [monthClosed, setMonthClosed] = useState(false)
  const [closingAction, setClosingAction] = useState(false)

  const isSenior = user && SENIOR_ROLES.includes(user.role)

  // Drill-down state
  const [expandedSupplier, setExpandedSupplier] = useState(null) // supplier_id or null
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Statement upload modal
  const [showUpload, setShowUpload] = useState(null) // supplier object or null
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTotal, setUploadTotal] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    fetchReport()
    setExpandedSupplier(null)
    setDetailData(null)
  }, [view, month])

  // Check monthly close status
  useEffect(() => {
    if (month) {
      const [y, mo] = month.split('-').map(Number)
      checkMonthClose(y, mo)
    }
  }, [month])

  const checkMonthClose = async (year, mo) => {
    try {
      const res = await monthlyCloseAPI.summary(year, mo)
      setMonthClosed(res.data.monthly_close?.status === 'CLOSED')
    } catch {
      setMonthClosed(false)
    }
  }

  const handleCloseMonth = async () => {
    const [y, mo] = month.split('-').map(Number)
    setClosingAction(true)
    try {
      await monthlyCloseAPI.closeMonth({ year: y, month: mo })
      setMonthClosed(true)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to close month.')
    } finally {
      setClosingAction(false)
    }
  }

  const handleReopenMonth = async () => {
    const [y, mo] = month.split('-').map(Number)
    setClosingAction(true)
    try {
      await monthlyCloseAPI.reopen({ year: y, month: mo })
      setMonthClosed(false)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to reopen month.')
    } finally {
      setClosingAction(false)
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    setError('')
    setIsPlaceholder(false)
    try {
      const params = view === 'monthly'
        ? { month }
        : { start_date: `${month}-01`, end_date: getMonthEnd(month) }
      const response = await reportsAPI.getSupplyReport(view, params)
      const d = response.data

      setData(d)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load expense report.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch drill-down detail for a supplier
  const toggleSupplierDetail = async (supplierId) => {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null)
      setDetailData(null)
      return
    }

    setExpandedSupplier(supplierId)
    setDetailLoading(true)

    if (isPlaceholder) {
      // Use placeholder detail
      setDetailData(PLACEHOLDER_DETAIL[supplierId] || null)
      setDetailLoading(false)
      return
    }

    try {
      const res = await reportsAPI.getSupplyDetail(supplierId, month)
      setDetailData(res.data)
    } catch {
      setDetailData(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const getMonthEnd = (m) => {
    const [y, mo] = m.split('-').map(Number)
    const lastDay = new Date(y, mo, 0).getDate()
    return `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }

  const fmt = (v) =>
    `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const fmtDate = (d) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    } catch {
      return d
    }
  }

  const fmtDateShort = (d) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      })
    } catch {
      return d
    }
  }

  // Handle statement upload
  const handleUploadStatement = async (e) => {
    e.preventDefault()
    if (!showUpload || !uploadFile || !uploadTotal) return

    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('supplier', showUpload.supplier_id)
      formData.append('statement_file', uploadFile)
      formData.append('statement_total', uploadTotal)
      if (uploadNotes) formData.append('notes', uploadNotes)

      const [y, mo] = month.split('-').map(Number)
      formData.append('year', y)
      formData.append('month', mo)

      await supplierStatementAPI.upload(formData)

      // Reset & refresh
      setShowUpload(null)
      setUploadFile(null)
      setUploadTotal('')
      setUploadNotes('')
      fetchReport()
    } catch (err) {
      setUploadError(err.response?.data?.detail || err.response?.data?.statement_file?.[0] || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  // Re-reconcile
  const handleReconcile = async (statementId) => {
    try {
      await supplierStatementAPI.reconcile(statementId)
      fetchReport()
    } catch (err) {
      setError('Reconcile failed.')
    }
  }

  // Count mismatches for KPI
  const mismatchCount = data?.suppliers?.filter(s => s.statement?.status === 'MISMATCHED').length || 0
  const matchedCount = data?.suppliers?.filter(s => s.statement?.status === 'MATCHED').length || 0

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* View toggle */}
          <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setView(opt.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  view === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {monthClosed && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
                <span>🔒</span> Month Locked
              </span>
            )}
            {/* Month picker */}
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Placeholder notice */}
      {isPlaceholder && !loading && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          Showing sample data — add supplier costs in Daily Closing to see real data.
        </div>
      )}

      {/* Data — Monthly View */}
      {!loading && data && view === 'monthly' && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Total Supply Cost" value={fmt(data.grand_total)} />
            <KpiCard
              label="Reconciled"
              value={`${matchedCount}/${data.suppliers?.length || 0}`}
              sub="suppliers matched"
            />
            {mismatchCount > 0 ? (
              <KpiCard label="Mismatches" value={`${mismatchCount}`} sub="need attention" />
            ) : (
              <KpiCard label="Suppliers" value={`${data.suppliers?.length || 0}`} sub="active this month" />
            )}
          </div>

          {/* Supplier Summary Table */}
          <SectionLabel>Supplier Summary</SectionLabel>
          <p className="text-xs text-gray-400 -mt-4 mb-2">Tap a supplier row to see daily entries</p>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Supplier</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Our Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Entries</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Statement</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Variance</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.suppliers || []).map((s) => {
                    const hasStatement = s.statement && s.statement.status
                    const variance = hasStatement ? parseFloat(s.statement.variance || 0) : null
                    const isExpanded = expandedSupplier === s.supplier_id
                    return (
                      <>
                        {/* Supplier summary row */}
                        <tr
                          key={s.supplier_id}
                          onClick={() => toggleSupplierDetail(s.supplier_id)}
                          className={`cursor-pointer transition ${
                            isExpanded ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                &#9654;
                              </span>
                              {s.supplier_name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(s.total)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{s.entry_count}</td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {hasStatement ? fmt(s.statement.statement_total) : '—'}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${
                            variance === null ? 'text-gray-400' : variance === 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {variance !== null ? fmt(variance) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasStatement ? (
                              s.statement.status === 'MATCHED' ? (
                                <Badge variant="success">Match</Badge>
                              ) : (
                                <Badge variant="danger">Mismatch</Badge>
                              )
                            ) : (
                              <Badge variant="neutral">Pending</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {hasStatement ? (
                              <button
                                onClick={() => handleReconcile(s.statement.id)}
                                className="text-xs text-blue-600 hover:underline font-medium"
                              >
                                Re-check
                              </button>
                            ) : (
                              <button
                                onClick={() => setShowUpload(s)}
                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition font-medium"
                              >
                                Upload
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Drill-down detail rows */}
                        {isExpanded && (
                          <tr key={`detail-${s.supplier_id}`}>
                            <td colSpan={7} className="p-0">
                              <div className="bg-gray-50 border-t border-b border-gray-200">
                                {detailLoading ? (
                                  <div className="flex justify-center py-6">
                                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                  </div>
                                ) : !detailData ? (
                                  <p className="text-sm text-gray-400 text-center py-4">No detail data available</p>
                                ) : (
                                  <div className="px-4 py-3 space-y-3">
                                    {/* Mismatch callout */}
                                    {hasStatement && s.statement.status === 'MISMATCHED' && (
                                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
                                        <p className="font-semibold text-red-700 mb-1">Mismatch Investigation</p>
                                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-red-600">
                                          <span>Our total: <b>{fmt(s.total)}</b></span>
                                          <span>Statement: <b>{fmt(s.statement.statement_total)}</b></span>
                                          <span>Variance: <b>{fmt(s.statement.variance)}</b></span>
                                        </div>
                                        <p className="text-xs text-red-500 mt-2">
                                          Compare each entry below with the supplier statement to find the discrepancy.
                                        </p>
                                      </div>
                                    )}

                                    {/* Daily entries */}
                                    {(detailData.daily_entries || []).map((day) => (
                                      <div key={day.date} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="flex justify-between items-center px-4 py-2 bg-gray-100/50 border-b border-gray-100">
                                          <span className="text-xs font-semibold text-gray-700">{fmtDateShort(day.date)}</span>
                                          <span className="text-xs font-semibold text-gray-900">{fmt(day.subtotal)}</span>
                                        </div>
                                        <div className="divide-y divide-gray-50">
                                          {(day.entries || []).map((entry, eidx) => (
                                            <div key={eidx} className="flex justify-between items-center px-4 py-2">
                                              <div className="flex items-center gap-2 min-w-0">
                                                {entry.invoice_number && (
                                                  <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">
                                                    {entry.invoice_number}
                                                  </span>
                                                )}
                                                <span className="text-xs text-gray-500 truncate">{entry.description || '—'}</span>
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800 ml-3 flex-shrink-0">{fmt(entry.amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}

                                    {/* Total bar */}
                                    <div className="flex justify-between items-center px-2 py-2 border-t border-gray-200">
                                      <span className="text-xs font-semibold text-gray-600">
                                        {detailData.entry_count || 0} entries total
                                      </span>
                                      <span className="text-sm font-bold text-gray-900">{fmt(detailData.total)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Data — Daily View */}
      {!loading && data && view === 'daily' && (
        <>
          {(data.daily_reports || []).length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-400 text-sm">No supply data for this month.</p>
            </Card>
          ) : (
            (data.daily_reports || []).map((day) => (
              <Card key={day.date} className="overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <p className="text-sm font-semibold text-gray-900">{fmtDate(day.date)}</p>
                  <span className="text-sm font-semibold text-gray-700">{fmt(day.total)}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {(day.suppliers || []).map((sup, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-center px-5 py-2.5">
                        <span className="text-sm font-medium text-gray-800">{sup.supplier_name}</span>
                        <span className="text-sm font-semibold text-gray-900">{fmt(sup.subtotal)}</span>
                      </div>
                      {(sup.entries || []).map((entry, eidx) => (
                        <div key={eidx} className="flex justify-between items-center px-5 pl-10 py-1.5 bg-gray-50/50">
                          <div className="flex items-center gap-2">
                            {entry.invoice_number && (
                              <Badge variant="neutral">{entry.invoice_number}</Badge>
                            )}
                            <span className="text-xs text-gray-500">{entry.description || '—'}</span>
                          </div>
                          <span className="text-xs font-medium text-gray-600">{fmt(entry.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </>
      )}

      {/* Monthly Close/Lock */}
      {view === 'monthly' && isSenior && !loading && data && !isPlaceholder && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {monthClosed ? '🔒 Month Closed' : 'Close Month'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {monthClosed
                  ? 'Supply data for this month is locked.'
                  : 'Lock supply data after reconciliation is complete.'}
              </p>
            </div>
            {monthClosed ? (
              <button
                onClick={handleReopenMonth}
                disabled={closingAction}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:bg-gray-300 transition"
              >
                {closingAction ? 'Reopening...' : 'Reopen'}
              </button>
            ) : (
              <button
                onClick={handleCloseMonth}
                disabled={closingAction}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:bg-gray-300 transition"
              >
                {closingAction ? 'Closing...' : 'Close & Lock'}
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Statement Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Upload Statement — {showUpload.supplier_name}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Our recorded total: <span className="font-semibold">{fmt(showUpload.total)}</span>
            </p>

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadStatement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statement File
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">Max 10MB (PDF, JPG, PNG, XLSX)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statement Total ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={uploadTotal}
                  onChange={(e) => setUploadTotal(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows="2"
                  placeholder="Any notes..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowUpload(null); setUploadError(''); }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile || !uploadTotal}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition"
                >
                  {uploading ? 'Uploading...' : 'Upload & Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

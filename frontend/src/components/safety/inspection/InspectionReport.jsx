import { useState, useEffect } from 'react'
import { safetyAPI } from '../../../services/api'
import { getTodayNZ, formatDateNZ } from '../../../utils/date'
import PageHeader from '../../ui/PageHeader'
import Card from '../../ui/Card'
import { ShieldIcon, CheckCircleIcon, ClockIcon, WarningIcon } from '../../icons'

const CATEGORY_LABELS = {
  DAILY: { label: 'Daily Records', emoji: '📋' },
  WEEKLY: { label: 'Weekly Records', emoji: '📅' },
  MONTHLY: { label: 'Monthly Records', emoji: '📆' },
  EVENT: { label: 'Event Records', emoji: '⚠️' },
  SETUP: { label: 'Setup / Reference', emoji: '📌' },
  SPECIALIST: { label: 'Specialist Records', emoji: '🔬' },
}

const STATUS_STYLES = {
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
  FLAGGED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Flagged' },
  REVIEWED: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Reviewed' },
}

export default function InspectionReport() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return formatDateNZ(d)
  })
  const [dateTo, setDateTo] = useState(() => getTodayNZ())
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedCategories, setExpandedCategories] = useState({})
  const [expandedTypes, setExpandedTypes] = useState({})
  const [selectedRecord, setSelectedRecord] = useState(null)

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = { date_from: dateFrom, date_to: dateTo }
      if (categoryFilter) params.category = categoryFilter
      if (statusFilter) params.status = statusFilter
      const res = await safetyAPI.getInspectionReport(params)
      setReport(res.data)
      // Auto-expand all categories
      const expanded = {}
      res.data.categories?.forEach(cat => { expanded[cat.category] = true })
      setExpandedCategories(expanded)
    } catch (err) {
      console.error('Failed to fetch inspection report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [dateFrom, dateTo, categoryFilter, statusFilter])

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const toggleType = (code) => {
    setExpandedTypes(prev => ({ ...prev, [code]: !prev[code] }))
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    const h = parseInt(parts[0])
    const m = parts[1]
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${m} ${ampm}`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric', weekday: 'short' })
  }

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Food Safety Records"
          subtitle="Inspection-ready record viewer"
          icon={<ShieldIcon size={24} />}
        />
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition print:hidden"
        >
          🖨 Print
        </button>
      </div>

      {/* Filters */}
      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputCls}>
              <option value="">All</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="EVENT">Event</option>
              <option value="SETUP">Setup</option>
              <option value="SPECIALIST">Specialist</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
              <option value="">All</option>
              <option value="COMPLETED">Completed</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="FLAGGED">Flagged</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !report || report.categories?.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-400">No records found for the selected period.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="print:block">
            <Card className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Period: <span className="font-medium text-gray-900">{formatDate(report.date_from)} — {formatDate(report.date_to)}</span>
                  <span className="ml-2 text-gray-400">({report.total_days} days)</span>
                </span>
              </div>
            </Card>
          </div>

          {/* Categories */}
          {report.categories.map((cat) => {
            const catInfo = CATEGORY_LABELS[cat.category] || { label: cat.category, emoji: '📄' }
            const isExpanded = expandedCategories[cat.category]
            const totalRecords = cat.record_types.reduce((sum, rt) => sum + rt.total_records, 0)

            return (
              <Card key={cat.category}>
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(cat.category)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-2">
                    <span>{catInfo.emoji}</span>
                    <span className="font-semibold text-gray-900">{catInfo.label}</span>
                    <span className="text-xs text-gray-400">({totalRecords} records)</span>
                  </div>
                  <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {cat.record_types.map((rtGroup) => {
                      const rt = rtGroup.record_type
                      const isTypeExpanded = expandedTypes[rt.code]

                      return (
                        <div key={rt.code}>
                          {/* Record type header */}
                          <button
                            onClick={() => toggleType(rt.code)}
                            className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div
                                className="w-2 h-8 rounded-full flex-shrink-0"
                                style={{ backgroundColor: rt.color_code || '#3B82F6' }}
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{rt.name}</p>
                                {rt.name_ko && <p className="text-xs text-gray-400 truncate">{rt.name_ko}</p>}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                              {/* Compliance bar */}
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      rtGroup.compliance_rate >= 90 ? 'bg-emerald-500' :
                                      rtGroup.compliance_rate >= 70 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(rtGroup.compliance_rate, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold ${
                                  rtGroup.compliance_rate >= 90 ? 'text-emerald-600' :
                                  rtGroup.compliance_rate >= 70 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                  {rtGroup.compliance_rate}%
                                </span>
                              </div>

                              <span className="text-xs text-gray-400">
                                {rtGroup.unique_dates}/{rtGroup.total_days}
                              </span>
                              <span className="text-gray-400 text-xs">{isTypeExpanded ? '▲' : '▼'}</span>
                            </div>
                          </button>

                          {/* Individual records */}
                          {isTypeExpanded && (
                            <div className="bg-gray-50/50 divide-y divide-gray-100">
                              {rtGroup.records.map((record) => {
                                const statusStyle = STATUS_STYLES[record.status] || STATUS_STYLES.PENDING
                                return (
                                  <button
                                    key={record.id}
                                    onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                                    className="w-full px-5 py-2.5 flex items-center justify-between text-left hover:bg-white transition text-sm"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-gray-400 text-xs w-20">{formatDate(record.date)}</span>
                                      {record.time && (
                                        <span className="text-gray-400 text-xs">{formatTime(record.time)}</span>
                                      )}
                                      <span className="text-gray-600">{record.completed_by_name || '-'}</span>
                                    </div>
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                                      {statusStyle.label}
                                    </span>
                                  </button>
                                )
                              })}

                              {/* Record detail when selected */}
                              {selectedRecord && rtGroup.records.some(r => r.id === selectedRecord.id) && (
                                <div className="px-5 py-4 bg-white border-t border-gray-200">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-semibold text-gray-900">Record Details</h4>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedRecord(null) }}
                                        className="text-xs text-gray-400 hover:text-gray-600"
                                      >
                                        Close
                                      </button>
                                    </div>

                                    {/* Data fields */}
                                    {selectedRecord.data && Object.keys(selectedRecord.data).length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {Object.entries(selectedRecord.data).map(([key, val]) => (
                                          <div key={key} className="flex items-start gap-2 text-sm">
                                            <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                                            <span className="text-gray-900 font-medium">
                                              {typeof val === 'boolean' ? (val ? '✓' : '✗') : String(val)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400">Quick completion — no detailed data</p>
                                    )}

                                    {selectedRecord.notes && (
                                      <div className="text-sm">
                                        <span className="text-gray-500">Notes: </span>
                                        <span className="text-gray-700">{selectedRecord.notes}</span>
                                      </div>
                                    )}

                                    {selectedRecord.reviewed_by_name && (
                                      <div className="text-sm text-blue-600">
                                        ✓ Reviewed by {selectedRecord.reviewed_by_name}
                                        {selectedRecord.reviewed_at && ` on ${new Date(selectedRecord.reviewed_at).toLocaleDateString()}`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body { font-size: 12px; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { skyReportAPI } from '../../services/api'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import { ChartIcon } from '../icons'

const MONTHS = [
  { value: 1, label: 'JAN', full: 'January' },
  { value: 2, label: 'FEB', full: 'February' },
  { value: 3, label: 'MAR', full: 'March' },
  { value: 4, label: 'APR', full: 'April' },
  { value: 5, label: 'MAY', full: 'May' },
  { value: 6, label: 'JUN', full: 'June' },
  { value: 7, label: 'JUL', full: 'July' },
  { value: 8, label: 'AUG', full: 'August' },
  { value: 9, label: 'SEP', full: 'September' },
  { value: 10, label: 'OCT', full: 'October' },
  { value: 11, label: 'NOV', full: 'November' },
  { value: 12, label: 'DEC', full: 'December' },
]

const EMPTY_FORM = {
  total_sales_inc_gst: '', hq_cash: '', pos_sales: '', other_sales: '',
  cogs: '', operating_expenses: '', wages: '',
  sales_per_hour: '', opening_sales_per_hour: '', tab_allowance_sales: '',
  payable_gst: '', sub_gst: '', operating_profit: '',
  total_sales_garage: '', hq_cash_garage: '',
  total_cogs_xero: '', total_expense_xero: '',
  labour_xero: '', sub_contractor_xero: '',
  number_of_days: '', number_of_payruns: '',
  sales_goal: '', cogs_goal: '', wage_goal: '',
  review_rating: '', review_goal: '',
  hygiene_grade: 'A',
  sales_notes: '', cogs_notes: '', wage_notes: '', next_month_notes: '',
}

const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'text-xs text-gray-500 mb-1 block'

function fmt(v) {
  if (v === null || v === undefined || v === '' || v === '0.00' || v === '0') return '-'
  const n = parseFloat(v)
  if (isNaN(n) || n === 0) return '-'
  return n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(v) {
  if (v === null || v === undefined || v === '' || v === '0.0') return '-'
  const n = parseFloat(v)
  if (isNaN(n) || n === 0) return '-'
  return n.toFixed(1) + '%'
}

export default function SkyReport() {
  const [tab, setTab] = useState('monthly') // 'monthly' | 'custom'
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [editing, setEditing] = useState(false)
  const [editingReport, setEditingReport] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)

  // Custom view state
  const [summaryData, setSummaryData] = useState(null)

  const loadReports = async () => {
    setLoading(true)
    try {
      const res = await skyReportAPI.list({ year })
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setReports(data)
    } catch { setReports([]) }
    finally { setLoading(false) }
  }

  const loadSummary = async () => {
    try {
      const res = await skyReportAPI.summary(year)
      setSummaryData(res.data)
    } catch { setSummaryData(null) }
  }

  useEffect(() => {
    loadReports()
    loadSummary()
  }, [year])

  const currentReport = reports.find(r => r.month === selectedMonth)

  const startEditing = async () => {
    setError('')
    setSuccess('')
    if (currentReport) {
      setEditingReport(currentReport)
      const f = { ...EMPTY_FORM }
      Object.keys(f).forEach(k => {
        if (currentReport[k] !== undefined && currentReport[k] !== null) {
          f[k] = String(currentReport[k])
        }
      })
      setForm(f)
    } else {
      setEditingReport(null)
      setForm({ ...EMPTY_FORM })
    }
    setEditing(true)

    // Auto-fill Total Sales and HQ Cash from DailyClosing data
    try {
      const res = await skyReportAPI.autoFill(year, selectedMonth)
      const auto = res.data
      setForm(prev => ({
        ...prev,
        total_sales_garage: auto.total_sales_garage ? String(auto.total_sales_garage) : prev.total_sales_garage,
        hq_cash_garage: auto.hq_cash_garage ? String(auto.hq_cash_garage) : prev.hq_cash_garage,
        total_cogs_xero: auto.total_cogs_xero ? String(auto.total_cogs_xero) : prev.total_cogs_xero,
        number_of_days: auto.number_of_days ? String(auto.number_of_days) : prev.number_of_days,
      }))
    } catch {
      // Silently fail — auto-fill is optional
    }
  }

  const cancelEditing = () => {
    setEditing(false)
    setError('')
    setSuccess('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const data = { year, month: selectedMonth }
      Object.keys(EMPTY_FORM).forEach(k => {
        const v = form[k]
        if (k === 'hygiene_grade' || k.endsWith('_notes')) {
          data[k] = v
        } else if (k === 'number_of_days' || k === 'number_of_payruns') {
          data[k] = parseInt(v) || 0
        } else {
          data[k] = parseFloat(v) || 0
        }
      })

      if (editingReport) {
        await skyReportAPI.update(editingReport.id, data)
      } else {
        await skyReportAPI.create(data)
      }
      setSuccess('Saved successfully')
      setEditing(false)
      loadReports()
      loadSummary()
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!currentReport || !confirm('Delete this report?')) return
    try {
      await skyReportAPI.delete(currentReport.id)
      loadReports()
      loadSummary()
    } catch {}
  }

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await skyReportAPI.downloadTemplate()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'sky_report_template.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download template')
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    setUploadResult(null)
    try {
      const res = await skyReportAPI.upload(file)
      setUploadResult(res.data)
      setSuccess(`Uploaded: ${res.data.created} created, ${res.data.updated} updated`)
      loadReports()
      loadSummary()
      setTimeout(() => { setSuccess(''); setUploadResult(null) }, 5000)
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.full || ''

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<ChartIcon size={24} />}
        title="Sky Report"
        subtitle="Monthly financial overview"
        action={
          <div className="flex items-center gap-3">
            <button onClick={() => setYear(y => y - 1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">←</button>
            <span className="text-lg font-bold text-gray-900">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">→</button>
          </div>
        }
      />

      {/* Tab Toggle + Actions */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-xl p-1 flex gap-1">
            <button
              onClick={() => { setTab('monthly'); setEditing(false) }}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                tab === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => { setTab('custom'); setEditing(false) }}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                tab === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Custom
            </button>
          </div>
          <button onClick={handleDownloadTemplate}
            className="px-3 py-2.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition whitespace-nowrap">
            Template
          </button>
          <label className={`px-3 py-2.5 text-xs font-semibold text-green-600 bg-green-50 rounded-xl hover:bg-green-100 transition cursor-pointer whitespace-nowrap ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? 'Uploading...' : 'Upload'}
            <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </Card>

      {/* Upload Result */}
      {uploadResult && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          {uploadResult.created > 0 && <span>{uploadResult.created} new reports created. </span>}
          {uploadResult.updated > 0 && <span>{uploadResult.updated} reports updated. </span>}
          {uploadResult.errors?.length > 0 && (
            <div className="mt-1 text-red-600">{uploadResult.errors.map((e, i) => <div key={i}>{e}</div>)}</div>
          )}
        </div>
      )}

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'monthly' ? (
        <MonthlyView
          year={year}
          selectedMonth={selectedMonth}
          setSelectedMonth={(m) => { setSelectedMonth(m); setEditing(false); setError(''); setSuccess('') }}
          currentReport={currentReport}
          reports={reports}
          editing={editing}
          form={form}
          updateField={updateField}
          startEditing={startEditing}
          cancelEditing={cancelEditing}
          handleSave={handleSave}
          handleDelete={handleDelete}
          saving={saving}
          editingReport={editingReport}
          monthLabel={monthLabel}
        />
      ) : (
        <CustomView
          year={year}
          summaryData={summaryData}
          reports={reports}
        />
      )}
    </div>
  )
}

// ===== MONTHLY VIEW =====
function MonthlyView({
  year, selectedMonth, setSelectedMonth, currentReport, reports,
  editing, form, updateField, startEditing, cancelEditing, handleSave, handleDelete,
  saving, editingReport, monthLabel,
}) {
  return (
    <>
      {/* Month Selector */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
        {MONTHS.map(m => {
          const hasData = reports.some(r => r.month === m.value)
          const active = selectedMonth === m.value
          return (
            <button
              key={m.value}
              onClick={() => setSelectedMonth(m.value)}
              className={`p-2.5 rounded-xl text-center transition border ${
                active
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : hasData
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <p className="text-sm font-bold">{m.label}</p>
              {hasData && !active && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mx-auto mt-1" />}
            </button>
          )
        })}
      </div>

      {/* Month Title + Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{monthLabel} {year}</h2>
        <div className="flex gap-2">
          {!editing && (
            <button
              onClick={startEditing}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
            >
              {currentReport ? 'Edit' : '+ New Report'}
            </button>
          )}
          {!editing && currentReport && (
            <button onClick={handleDelete}
              className="px-3 py-2 text-sm font-medium text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition">
              Delete
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <ReportForm
          form={form}
          updateField={updateField}
          handleSave={handleSave}
          cancelEditing={cancelEditing}
          saving={saving}
          editingReport={editingReport}
        />
      ) : currentReport ? (
        <ReportDetail report={currentReport} />
      ) : (
        <Card className="p-8 text-center">
          <p className="text-gray-400 text-sm">No report for {monthLabel} {year}</p>
          <button onClick={startEditing}
            className="mt-3 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition">
            + Create Report
          </button>
        </Card>
      )}
    </>
  )
}

// ===== REPORT DETAIL (Read-only view) =====
function ReportDetail({ report }) {
  const r = report
  const exclGst = parseFloat(r.excl_gst_sales) || 0
  const salesRatio = (field) => {
    if (exclGst === 0) return '-'
    const val = parseFloat(r[field]) || 0
    return (val / exclGst * 100).toFixed(1) + '%'
  }

  return (
    <>
      {/* P&L Summary */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">P&L Summary</h3>
        <div className="space-y-1">
          <DetailRow label="총매출 (GST 포함)" labelEn="Total Sales inc.GST" value={`$${fmt(r.total_sales_inc_gst)}`} highlight />
          <DetailRow label="매출 (GST 제외)" labelEn="EXCL GST" value={`$${fmt(r.excl_gst_sales)}`} />
          <DetailRow label="현금" labelEn="HQ CASH" value={`$${fmt(r.hq_cash)}`} />
          <div className="border-t border-gray-100 my-2" />
          <DetailRow label="매출원가" labelEn="COGS" value={`$${fmt(r.cogs)}`} ratio={salesRatio('cogs')} />
          <DetailRow label="운영비용" labelEn="Operating Expenses" value={`$${fmt(r.operating_expenses)}`} ratio={salesRatio('operating_expenses')} />
          <DetailRow label="인건비" labelEn="Wages" value={`$${fmt(r.sales_per_hour)}`} ratio={salesRatio('sales_per_hour')} />
          <div className="border-t border-gray-100 my-2" />
          <DetailRow label="납부할 GST" labelEn="Payable GST" value={`$${fmt(r.payable_gst)}`} />
          <DetailRow label="영업이익 (세전)" labelEn="Operating Profit" value={`$${fmt(r.operating_profit)}`} highlight />
        </div>
      </Card>

      {/* Input Data */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Input Data</h3>
        <div className="space-y-1">
          <DetailRow label="자동" labelEn="Total Sales" value={`$${fmt(r.total_sales_garage)}`} />
          <DetailRow label="자동" labelEn="HQ CASH" value={`$${fmt(r.hq_cash_garage)}`} />
          <DetailRow label="자동" labelEn="COGS" value={`$${fmt(r.total_cogs_xero)}`} />
          <div className="border-t border-gray-100 my-2" />
          <DetailRow label="입력" labelEn="Total Expense" value={`$${fmt(r.total_expense_xero)}`} />
          <DetailRow label="입력" labelEn="Labour" value={`$${fmt(r.labour_xero)}`} />
          {parseFloat(r.sub_contractor_xero) > 0 && (
            <DetailRow label="입력" labelEn="Sub-contractor" value={`$${fmt(r.sub_contractor_xero)}`} />
          )}
          <DetailRow label="" labelEn="Trading Days" value={r.number_of_days || '-'} />
          <DetailRow label="" labelEn="Payruns" value={r.number_of_payruns || '-'} />
        </div>
      </Card>

      {/* Goals & Review */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Goals & Review</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MiniKpi label="Sales Goal" value={`$${fmt(r.sales_goal)}`} />
          <MiniKpi label="COGS Goal" value={`$${fmt(r.cogs_goal)}`} />
          <MiniKpi label="Wage Goal" value={`$${fmt(r.wage_goal)}`} />
          <MiniKpi label="Review Rating" value={r.review_rating > 0 ? r.review_rating : '-'} />
          <MiniKpi label="Review Goal" value={r.review_goal > 0 ? r.review_goal : '-'} />
          <MiniKpi label="Hygiene Grade" value={r.hygiene_grade || '-'} />
        </div>
      </Card>

      {/* Notes */}
      {(r.sales_notes || r.cogs_notes || r.wage_notes || r.next_month_notes) && (
        <Card className="p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Notes</h3>
          <div className="space-y-3">
            {r.sales_notes && <NoteBlock title="매출 (Sales)" text={r.sales_notes} />}
            {r.cogs_notes && <NoteBlock title="COGS / 운영비용" text={r.cogs_notes} />}
            {r.wage_notes && <NoteBlock title="인건비 (Wages)" text={r.wage_notes} />}
            {r.next_month_notes && <NoteBlock title="다음달 목표 (Next Month)" text={r.next_month_notes} />}
          </div>
        </Card>
      )}
    </>
  )
}

// ===== REPORT FORM =====
function ReportForm({ form, updateField, handleSave, cancelEditing, saving, editingReport }) {
  return (
    <>
      {/* Auto-filled from DailyClosing */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Auto Data (DailyClosing)</h3>
        <p className="text-xs text-gray-400 mb-4">CSV 업로드 데이터에서 자동 계산</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Total Sales (자동)</label>
            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-right text-blue-700 font-medium">
              ${parseFloat(form.total_sales_garage || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <label className={labelCls}>HQ CASH (자동)</label>
            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-right text-blue-700 font-medium">
              ${parseFloat(form.hq_cash_garage || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <label className={labelCls}>COGS (자동)</label>
            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-right text-blue-700 font-medium">
              ${parseFloat(form.total_cogs_xero || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <div>
            <label className={labelCls}>Trading Days (자동)</label>
            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-right text-blue-700 font-medium">
              {form.number_of_days || 0}
            </div>
          </div>
        </div>
      </Card>

      {/* Manager Input */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Manager Input</h3>
        <p className="text-xs text-gray-400 mb-4">매니저가 직접 입력하는 항목</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumField label="Total Expense (운영비 총액)" value={form.total_expense_xero} onChange={v => updateField('total_expense_xero', v)} prefix="$" />
            <NumField label="Labour (인건비)" value={form.labour_xero} onChange={v => updateField('labour_xero', v)} prefix="$" />
            <NumField label="Sub-contractor (있으면)" value={form.sub_contractor_xero} onChange={v => updateField('sub_contractor_xero', v)} prefix="$" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Number of Payruns</label>
              <input type="number" value={form.number_of_payruns} onChange={e => updateField('number_of_payruns', e.target.value)} className={inputCls} min="1" max="4" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Goals & Review</h3>
        <p className="text-xs text-gray-400 mb-4">Targets for the following month</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <NumField label="Sales Goal" value={form.sales_goal} onChange={v => updateField('sales_goal', v)} prefix="$" />
          <NumField label="COGS Goal" value={form.cogs_goal} onChange={v => updateField('cogs_goal', v)} prefix="$" />
          <NumField label="Wage Goal" value={form.wage_goal} onChange={v => updateField('wage_goal', v)} prefix="$" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <NumField label="Review Rating" value={form.review_rating} onChange={v => updateField('review_rating', v)} />
          <NumField label="Review Goal (Next)" value={form.review_goal} onChange={v => updateField('review_goal', v)} />
          <div>
            <label className={labelCls}>Hygiene Grade</label>
            <select value={form.hygiene_grade} onChange={e => updateField('hygiene_grade', e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['A', 'B', 'C', 'D', 'E'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Notes</h3>
        <p className="text-xs text-gray-400 mb-4">Monthly observations and goals</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Sales Notes (매출)</label>
            <textarea value={form.sales_notes} onChange={e => updateField('sales_notes', e.target.value)}
              rows={3} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className={labelCls}>COGS / Expense Notes (매출원가/운영비용)</label>
            <textarea value={form.cogs_notes} onChange={e => updateField('cogs_notes', e.target.value)}
              rows={3} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className={labelCls}>Wage Notes (인건비)</label>
            <textarea value={form.wage_notes} onChange={e => updateField('wage_notes', e.target.value)}
              rows={3} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className={labelCls}>Next Month Goals (다음달 목표)</label>
            <textarea value={form.next_month_notes} onChange={e => updateField('next_month_notes', e.target.value)}
              rows={3} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
          {saving ? 'Saving...' : editingReport ? 'Update Report' : 'Save Report'}
        </button>
        <button onClick={cancelEditing}
          className="px-6 py-3 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </>
  )
}

// ===== CUSTOM VIEW (Year Overview) =====
function CustomView({ year, summaryData, reports }) {
  if (!summaryData) return null

  const allReports = [...(summaryData.first_half || []), ...(summaryData.second_half || [])]

  return (
    <>
      {/* Annual KPIs */}
      {summaryData.annual_totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiBox label="Total Sales" value={`$${fmt(summaryData.annual_totals.total_sales)}`} />
          <KpiBox label="Total COGS" value={`$${fmt(summaryData.annual_totals.total_cogs)}`} sub={`${summaryData.annual_totals.cogs_ratio}%`} />
          <KpiBox label="Total Wages" value={`$${fmt(summaryData.annual_totals.total_wages)}`} sub={`${summaryData.annual_totals.wage_ratio}%`} />
          <KpiBox label="Reports Filed" value={`${allReports.length} / 12`} />
        </div>
      )}

      {/* Full Year Comparison Table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">{year} Year Overview</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-gray-500 font-semibold">Metric</th>
                {MONTHS.map(m => (
                  <th key={m.value} className="px-2 py-3 text-right text-gray-500 font-semibold">{m.label}</th>
                ))}
                <th className="px-3 py-3 text-right text-gray-900 font-bold">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <CompRow label="SALES" field="total_sales_inc_gst" reports={allReports} isCurrency />
              <CompRow label="COGS" field="cogs" reports={allReports} isCurrency showRatio />
              <CompRow label="WAGE" field="wages" reports={allReports} isCurrency showRatio />
              <CompRow label="OP.PROFIT" field="operating_profit" reports={allReports} isCurrency />
              <tr className="border-t border-gray-100">
                <td className="px-4 py-2 font-semibold text-gray-700">HYGIENE</td>
                {MONTHS.map(m => {
                  const r = allReports.find(rep => rep.month === m.value)
                  return <td key={m.value} className="px-2 py-2 text-right text-gray-600">{r?.hygiene_grade || '-'}</td>
                })}
                <td className="px-3 py-2 text-right text-gray-600">-</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-semibold text-gray-700">REVIEW</td>
                {MONTHS.map(m => {
                  const r = allReports.find(rep => rep.month === m.value)
                  return <td key={m.value} className="px-2 py-2 text-right text-gray-600">{r?.review_rating > 0 ? r.review_rating : '-'}</td>
                })}
                <td className="px-3 py-2 text-right text-gray-600">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

// ===== SUB COMPONENTS =====
function NumField({ label, value, onChange, prefix = '' }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{prefix}</span>}
        <input type="number" step="0.01" value={value} onChange={e => onChange(e.target.value)}
          className={`${inputCls} ${prefix ? 'pl-7' : ''}`} placeholder="0.00" />
      </div>
    </div>
  )
}

function DetailRow({ label, labelEn, value, sub, subLabel, ratio, highlight }) {
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${highlight ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
      <div className="min-w-0">
        {label && <span className="text-xs text-gray-400 mr-2">{label}</span>}
        <span className="text-sm text-gray-700 font-medium">{labelEn}</span>
      </div>
      <div className="text-right ml-4 shrink-0">
        <span className={`text-sm font-bold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>{value}</span>
        {ratio && ratio !== '-' && <span className="text-xs text-gray-400 ml-2">({ratio})</span>}
        {sub && <span className="block text-xs text-gray-400">{subLabel}: {sub}</span>}
      </div>
    </div>
  )
}

function MiniKpi({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}

function NoteBlock({ title, text }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-500 mb-1">{title}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{text}</p>
    </div>
  )
}

function KpiBox({ label, value, sub }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-blue-600 font-semibold mt-0.5">{sub}</p>}
    </Card>
  )
}

function CompRow({ label, field, reports, isCurrency, showRatio }) {
  const vals = MONTHS.map(m => {
    const r = reports.find(rep => rep.month === m.value)
    return r ? parseFloat(r[field]) || 0 : 0
  })
  const total = vals.reduce((a, b) => a + b, 0)
  const totalSales = MONTHS.reduce((sum, m) => {
    const r = reports.find(rep => rep.month === m.value)
    return sum + (r ? parseFloat(r.total_sales_inc_gst) || 0 : 0)
  }, 0)
  const ratio = showRatio && totalSales > 0 ? (total / totalSales * 100).toFixed(1) + '%' : ''

  return (
    <tr className="border-b border-gray-50">
      <td className="px-4 py-2 font-semibold text-gray-700">{label}</td>
      {vals.map((v, i) => (
        <td key={i} className="px-2 py-2 text-right text-gray-600 font-medium">
          {v === 0 ? '-' : isCurrency ? `$${fmt(v)}` : fmt(v)}
        </td>
      ))}
      <td className="px-3 py-2 text-right font-bold text-gray-900">
        {total === 0 ? '-' : isCurrency ? `$${fmt(total)}` : fmt(total)}
        {ratio && <span className="block text-xs text-gray-400 font-normal">{ratio}</span>}
      </td>
    </tr>
  )
}

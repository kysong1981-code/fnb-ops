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
  const [tab, setTab] = useState('overview') // 'overview' | 'monthly' | 'custom'
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [reports, setReports] = useState([])
  const [lastYearReports, setLastYearReports] = useState([])
  const [twoYearsAgoReports, setTwoYearsAgoReports] = useState([])
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

  const loadLastYear = async () => {
    try {
      const res = await skyReportAPI.list({ year: year - 1 })
      setLastYearReports(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch { setLastYearReports([]) }
  }

  const loadTwoYearsAgo = async () => {
    try {
      const res = await skyReportAPI.list({ year: year - 2 })
      setTwoYearsAgoReports(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch { setTwoYearsAgoReports([]) }
  }

  useEffect(() => {
    loadReports()
    loadSummary()
    loadLastYear()
    loadTwoYearsAgo()
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
        number_of_days: auto.number_of_days ? String(auto.number_of_days) : prev.number_of_days,
        tab_allowance_sales: auto.opening_hours_per_day ? String(auto.opening_hours_per_day) : prev.tab_allowance_sales,
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
              onClick={() => { setTab('overview'); setEditing(false) }}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                tab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
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
      ) : tab === 'overview' ? (
        <OverviewDashboard reports={reports} lastYearReports={lastYearReports} twoYearsAgoReports={twoYearsAgoReports} year={year} />
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
        <CustomView year={year} />
      )}
    </div>
  )
}

// ===== OVERVIEW DASHBOARD =====
function OverviewDashboard({ reports, lastYearReports, twoYearsAgoReports, year }) {
  const [periodTab, setPeriodTab] = useState('current') // 'current' | 'previous'

  // Helper: get monthly data mapped by month number
  const getMonthData = (reps) => {
    const map = {}
    reps.forEach(r => { map[r.month] = r })
    return map
  }
  const currentMap = getMonthData(reports)
  const lastYearMap = getMonthData(lastYearReports)
  const twoYearsAgoMap = getMonthData(twoYearsAgoReports || [])

  // Sales values for bar chart (3 years)
  const currentSales = MONTHS.map(m => parseFloat(currentMap[m.value]?.total_sales_inc_gst) || 0)
  const lastYearSales = MONTHS.map(m => parseFloat(lastYearMap[m.value]?.total_sales_inc_gst) || 0)
  const twoYearsAgoSales = MONTHS.map(m => parseFloat(twoYearsAgoMap[m.value]?.total_sales_inc_gst) || 0)
  const maxSales = Math.max(...currentSales, ...lastYearSales, ...twoYearsAgoSales, 1)

  // YTD calculations
  const monthsWithData = reports.filter(r => parseFloat(r.total_sales_inc_gst) > 0)
  const totalSalesYTD = monthsWithData.reduce((s, r) => s + (parseFloat(r.total_sales_inc_gst) || 0), 0)
  const avgMonthlySales = monthsWithData.length > 0 ? totalSalesYTD / monthsWithData.length : 0

  const lastYearMonthsWithData = lastYearReports.filter(r => parseFloat(r.total_sales_inc_gst) > 0)
  const lastYearTotalSales = lastYearMonthsWithData.reduce((s, r) => s + (parseFloat(r.total_sales_inc_gst) || 0), 0)
  const yoyChange = lastYearTotalSales > 0 ? ((totalSalesYTD - lastYearTotalSales) / lastYearTotalSales * 100).toFixed(1) : null

  // 2-year-ago YTD
  const twoYearsAgoMonthsWithData = (twoYearsAgoReports || []).filter(r => parseFloat(r.total_sales_inc_gst) > 0)
  const twoYearsAgoTotalSales = twoYearsAgoMonthsWithData.reduce((s, r) => s + (parseFloat(r.total_sales_inc_gst) || 0), 0)
  const yoy2Change = twoYearsAgoTotalSales > 0 ? ((totalSalesYTD - twoYearsAgoTotalSales) / twoYearsAgoTotalSales * 100).toFixed(1) : null

  // Best month
  let bestMonth = null
  let bestSales = 0
  monthsWithData.forEach(r => {
    const s = parseFloat(r.total_sales_inc_gst) || 0
    if (s > bestSales) { bestSales = s; bestMonth = r }
  })
  const bestMonthLabel = bestMonth ? MONTHS.find(m => m.value === bestMonth.month)?.full : '-'

  // Avg profit margin
  const marginMonths = monthsWithData.filter(r => parseFloat(r.excl_gst_sales) > 0)
  const avgMargin = marginMonths.length > 0
    ? (marginMonths.reduce((s, r) => s + ((parseFloat(r.operating_profit) || 0) / (parseFloat(r.excl_gst_sales) || 1) * 100), 0) / marginMonths.length).toFixed(1)
    : '0.0'

  // P&L Trend data
  const plData = MONTHS.map(m => {
    const r = currentMap[m.value]
    if (!r) return null
    const sales = parseFloat(r.total_sales_inc_gst) || 0
    const excl = parseFloat(r.excl_gst_sales) || 0
    const cogs = parseFloat(r.cogs) || 0
    const wages = parseFloat(r.sales_per_hour) || 0
    const profit = parseFloat(r.operating_profit) || 0
    const cogsP = excl > 0 ? (cogs / excl * 100).toFixed(1) : '0.0'
    const wageP = excl > 0 ? (wages / excl * 100).toFixed(1) : '0.0'
    const marginP = excl > 0 ? (profit / excl * 100).toFixed(1) : '0.0'
    // LY Sales for same month
    const lySales = parseFloat(lastYearMap[m.value]?.total_sales_inc_gst) || 0
    return { label: m.label, sales, cogs, cogsP, wages, wageP, profit, marginP, month: m.value, lySales }
  }).filter(Boolean)

  // Get goals from most recent report
  const sortedReports = [...monthsWithData].sort((a, b) => b.month - a.month)
  const latestReport = sortedReports[0]
  const cogsGoal = parseFloat(latestReport?.cogs_goal) || 0
  const wageGoal = parseFloat(latestReport?.wage_goal) || 0

  // Goal Progress - current month report (or latest with goals)
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentMonthReport = currentMap[currentMonth]
  const goalReport = currentMonthReport || sortedReports.find(r => parseFloat(r.sales_goal) > 0 || parseFloat(r.cogs_goal) > 0 || parseFloat(r.wage_goal) > 0)
  const salesGoal = parseFloat(goalReport?.sales_goal) || 0
  const goalCogsTarget = parseFloat(goalReport?.cogs_goal) || 0
  const goalWageTarget = parseFloat(goalReport?.wage_goal) || 0
  const goalMonthLabel = MONTHS.find(m => m.value === (currentMonthReport ? currentMonth : goalReport?.month))?.full || ''
  const goalMonthYear = currentMonthReport ? year : (goalReport?.year || year)

  // Current month actuals for goal progress
  const goalActualSales = parseFloat(currentMonthReport?.total_sales_inc_gst) || 0
  const goalActualExcl = parseFloat(currentMonthReport?.excl_gst_sales) || 0
  const goalActualCogs = parseFloat(currentMonthReport?.cogs) || 0
  const goalActualWages = parseFloat(currentMonthReport?.sales_per_hour) || 0
  const goalActualCogsP = goalActualExcl > 0 ? (goalActualCogs / goalActualExcl * 100) : 0
  const goalActualWageP = goalActualExcl > 0 ? (goalActualWages / goalActualExcl * 100) : 0
  const salesProgress = salesGoal > 0 ? (goalActualSales / salesGoal * 100) : 0

  // H1/H2 Period calculations
  const H1_MONTHS = [4, 5, 6, 7, 8, 9]
  const H2_MONTHS = [10, 11, 12, 1, 2, 3]
  const isH2 = H2_MONTHS.includes(currentMonth)
  const currentPeriodLabel = isH2 ? 'H2' : 'H1'

  // Helper to compute period stats from reports array filtered by months
  const computePeriodStats = (reportsForPeriod) => {
    const valid = reportsForPeriod.filter(r => parseFloat(r.total_sales_inc_gst) > 0)
    if (valid.length === 0) return null
    const totalSales = valid.reduce((s, r) => s + (parseFloat(r.total_sales_inc_gst) || 0), 0)
    const totalExcl = valid.reduce((s, r) => s + (parseFloat(r.excl_gst_sales) || 0), 0)
    const totalCogs = valid.reduce((s, r) => s + (parseFloat(r.cogs) || 0), 0)
    const totalWages = valid.reduce((s, r) => s + (parseFloat(r.sales_per_hour) || 0), 0)
    const totalProfit = valid.reduce((s, r) => s + (parseFloat(r.operating_profit) || 0), 0)
    const avgCogsP = totalExcl > 0 ? (totalCogs / totalExcl * 100) : 0
    const avgWageP = totalExcl > 0 ? (totalWages / totalExcl * 100) : 0
    const profitMargin = totalExcl > 0 ? (totalProfit / totalExcl * 100) : 0
    return { totalSales, totalCogs, totalWages, totalProfit, avgCogsP, avgWageP, profitMargin, months: valid.length }
  }

  // Current H2 (Oct year-1 to Mar year): Oct-Dec from lastYearReports, Jan-Mar from reports
  const currentH2Reports = [
    ...lastYearReports.filter(r => [10, 11, 12].includes(r.month)),
    ...reports.filter(r => [1, 2, 3].includes(r.month)),
  ]
  // Previous H2 (Oct year-2 to Mar year-1): Oct-Dec from twoYearsAgoReports, Jan-Mar from lastYearReports
  const prevH2Reports = [
    ...(twoYearsAgoReports || []).filter(r => [10, 11, 12].includes(r.month)),
    ...lastYearReports.filter(r => [1, 2, 3].includes(r.month)),
  ]
  // Current H1 (Apr-Sep year): from reports
  const currentH1Reports = reports.filter(r => H1_MONTHS.includes(r.month))
  // Previous H1 (Apr-Sep year-1): from lastYearReports
  const prevH1Reports = lastYearReports.filter(r => H1_MONTHS.includes(r.month))
  // Previous H2 for H1 comparison (Oct year-1 to Mar year): same as currentH2
  const prevH2ForH1 = currentH2Reports

  const currentH2Stats = computePeriodStats(currentH2Reports)
  const prevH2Stats = computePeriodStats(prevH2Reports)
  const currentH1Stats = computePeriodStats(currentH1Reports)
  const prevH1Stats = computePeriodStats(prevH1Reports)
  const prevH2ForH1Stats = computePeriodStats(prevH2ForH1)

  // Determine which stats to show
  const activePeriodStats = isH2
    ? (periodTab === 'current' ? currentH2Stats : currentH1Stats)
    : (periodTab === 'current' ? currentH1Stats : currentH2Stats)

  const activePeriodLabel = isH2
    ? (periodTab === 'current' ? `H2 (Oct ${year - 1} - Mar ${year})` : `H1 (Apr - Sep ${year})`)
    : (periodTab === 'current' ? `H1 (Apr - Sep ${year})` : `H2 (Oct ${year - 1} - Mar ${year})`)

  // Comparisons for active period
  const getComparisons = () => {
    if (isH2 && periodTab === 'current') {
      // Current H2: compare vs previous H2 and previous H1
      const vsPrevH2 = prevH2Stats && currentH2Stats && prevH2Stats.totalSales > 0
        ? ((currentH2Stats.totalSales - prevH2Stats.totalSales) / prevH2Stats.totalSales * 100).toFixed(1) : null
      const vsPrevH1 = prevH1Stats && currentH2Stats && prevH1Stats.totalSales > 0
        ? ((currentH2Stats.totalSales - prevH1Stats.totalSales) / prevH1Stats.totalSales * 100).toFixed(1) : null
      return [
        { label: `vs H2 ${year - 2}/${year - 1}`, value: vsPrevH2 },
        { label: `vs H1 ${year - 1}`, value: vsPrevH1 },
      ]
    } else if (isH2 && periodTab !== 'current') {
      // Showing H1: compare vs prev H1 and prev H2
      const vsPrevH1 = prevH1Stats && currentH1Stats && prevH1Stats.totalSales > 0
        ? ((currentH1Stats.totalSales - prevH1Stats.totalSales) / prevH1Stats.totalSales * 100).toFixed(1) : null
      const vsPrevH2 = currentH2Stats && currentH1Stats && currentH2Stats.totalSales > 0
        ? ((currentH1Stats.totalSales - currentH2Stats.totalSales) / currentH2Stats.totalSales * 100).toFixed(1) : null
      return [
        { label: `vs H1 ${year - 1}`, value: vsPrevH1 },
        { label: `vs H2 ${year - 1}/${year}`, value: vsPrevH2 },
      ]
    } else if (!isH2 && periodTab === 'current') {
      // Current H1: compare vs prev H1 and prev H2
      const vsPrevH1 = prevH1Stats && currentH1Stats && prevH1Stats.totalSales > 0
        ? ((currentH1Stats.totalSales - prevH1Stats.totalSales) / prevH1Stats.totalSales * 100).toFixed(1) : null
      const vsPrevH2 = prevH2ForH1Stats && currentH1Stats && prevH2ForH1Stats.totalSales > 0
        ? ((currentH1Stats.totalSales - prevH2ForH1Stats.totalSales) / prevH2ForH1Stats.totalSales * 100).toFixed(1) : null
      return [
        { label: `vs H1 ${year - 1}`, value: vsPrevH1 },
        { label: `vs H2 ${year - 1}/${year}`, value: vsPrevH2 },
      ]
    } else {
      // Showing H2 when in H1: compare vs prev H2 and current H1
      const vsPrevH2 = prevH2Stats && currentH2Stats && prevH2Stats.totalSales > 0
        ? ((currentH2Stats.totalSales - prevH2Stats.totalSales) / prevH2Stats.totalSales * 100).toFixed(1) : null
      const vsH1 = currentH1Stats && currentH2Stats && currentH1Stats.totalSales > 0
        ? ((currentH2Stats.totalSales - currentH1Stats.totalSales) / currentH1Stats.totalSales * 100).toFixed(1) : null
      return [
        { label: `vs H2 ${year - 2}/${year - 1}`, value: vsPrevH2 },
        { label: `vs H1 ${year}`, value: vsH1 },
      ]
    }
  }
  const periodComparisons = getComparisons()

  // KPI Trends
  const trendData = plData.map(d => {
    const r = currentMap[d.month]
    const days = parseInt(r?.number_of_days) || 1
    const salesPerDay = (parseFloat(r?.total_sales_inc_gst) || 0) / days
    return {
      label: d.label,
      salesPerDay,
      cogsP: parseFloat(d.cogsP),
      wageP: parseFloat(d.wageP),
      marginP: parseFloat(d.marginP),
    }
  })

  return (
    <>
      {/* A. Annual Sales Bar Chart - 3 years */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Annual Sales Comparison</h3>
        <p className="text-xs text-gray-400 mb-4">{year - 2} vs {year - 1} vs {year}</p>
        <div className="flex items-end gap-1 sm:gap-2" style={{ height: 200 }}>
          {MONTHS.map((m, i) => {
            const curH = maxSales > 0 ? (currentSales[i] / maxSales * 100) : 0
            const lyH = maxSales > 0 ? (lastYearSales[i] / maxSales * 100) : 0
            const ty2H = maxSales > 0 ? (twoYearsAgoSales[i] / maxSales * 100) : 0
            return (
              <div key={m.value} className="flex-1 flex flex-col items-center gap-0">
                <div className="w-full flex items-end justify-center gap-px" style={{ height: 180 }}>
                  <div
                    className="flex-1 max-w-[10px] bg-gray-300 rounded-t"
                    style={{ height: `${ty2H}%`, minHeight: ty2H > 0 ? 2 : 0 }}
                    title={`${year - 2}: $${twoYearsAgoSales[i].toLocaleString()}`}
                  />
                  <div
                    className="flex-1 max-w-[10px] bg-gray-400 rounded-t"
                    style={{ height: `${lyH}%`, minHeight: lyH > 0 ? 2 : 0 }}
                    title={`${year - 1}: $${lastYearSales[i].toLocaleString()}`}
                  />
                  <div
                    className="flex-1 max-w-[10px] bg-blue-500 rounded-t"
                    style={{ height: `${curH}%`, minHeight: curH > 0 ? 2 : 0 }}
                    title={`${year}: $${currentSales[i].toLocaleString()}`}
                  />
                </div>
                <span className="text-[10px] text-gray-400 mt-1">{m.label}</span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
            <span className="text-xs text-gray-500">{year}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-400 rounded-sm" />
            <span className="text-xs text-gray-500">{year - 1}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-300 rounded-sm" />
            <span className="text-xs text-gray-500">{year - 2}</span>
          </div>
        </div>
      </Card>

      {/* B. YTD Summary Cards - with 2-year comparison */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Total Sales YTD</div>
          <div className="text-lg font-bold text-gray-900">${totalSalesYTD.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          {yoyChange !== null && (
            <div className={`text-xs font-medium mt-1 ${parseFloat(yoyChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {parseFloat(yoyChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(yoyChange))}% vs LY
            </div>
          )}
          {yoy2Change !== null && (
            <div className={`text-xs font-medium mt-0.5 ${parseFloat(yoy2Change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {parseFloat(yoy2Change) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(yoy2Change))}% vs 2Y ago
            </div>
          )}
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Avg Monthly Sales</div>
          <div className="text-lg font-bold text-gray-900">${avgMonthlySales.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-gray-400 mt-1">{monthsWithData.length} months</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Best Month</div>
          <div className="text-lg font-bold text-gray-900">{bestMonthLabel}</div>
          <div className="text-xs text-gray-400 mt-1">${bestSales.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Profit Margin</div>
          <div className={`text-lg font-bold ${parseFloat(avgMargin) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{avgMargin}%</div>
          <div className="text-xs text-gray-400 mt-1">avg operating</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">vs 2 Years Ago</div>
          <div className="text-lg font-bold text-gray-900">
            ${twoYearsAgoTotalSales.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">{year - 2} YTD</div>
        </Card>
      </div>

      {/* Goal Progress Section */}
      {(salesGoal > 0 || goalCogsTarget > 0 || goalWageTarget > 0) && (
        <Card className="p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Goal Progress</h3>
          <p className="text-xs text-gray-400 mb-4">{goalMonthLabel} {goalMonthYear}</p>
          <div className="space-y-4">
            {salesGoal > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-700">Sales Goal: ${salesGoal.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  <span className={`text-xs font-bold ${salesProgress >= 100 ? 'text-green-600' : salesProgress >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                    {salesProgress.toFixed(0)}% (${goalActualSales.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${salesProgress >= 100 ? 'bg-green-500' : salesProgress >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(salesProgress, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {goalCogsTarget > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-700">COGS Target: {goalCogsTarget}%</span>
                  <span className={`text-xs font-bold ${goalActualCogsP <= goalCogsTarget ? 'text-green-600' : goalActualCogsP <= goalCogsTarget * 1.05 ? 'text-amber-600' : 'text-red-600'}`}>
                    Current: {goalActualCogsP.toFixed(1)}% {goalActualCogsP <= goalCogsTarget ? ' (on track)' : ' (over target)'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${goalActualCogsP <= goalCogsTarget ? 'bg-green-500' : goalActualCogsP <= goalCogsTarget * 1.05 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(goalCogsTarget > 0 ? (goalActualCogsP / goalCogsTarget * 100) : 0, 120)}%`, maxWidth: '100%' }}
                  />
                </div>
              </div>
            )}
            {goalWageTarget > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-700">Wage Target: {goalWageTarget}%</span>
                  <span className={`text-xs font-bold ${goalActualWageP <= goalWageTarget ? 'text-green-600' : goalActualWageP <= goalWageTarget * 1.05 ? 'text-amber-600' : 'text-red-600'}`}>
                    Current: {goalActualWageP.toFixed(1)}% {goalActualWageP <= goalWageTarget ? ' (on track)' : ' (over target)'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${goalActualWageP <= goalWageTarget ? 'bg-green-500' : goalActualWageP <= goalWageTarget * 1.05 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(goalWageTarget > 0 ? (goalActualWageP / goalWageTarget * 100) : 0, 120)}%`, maxWidth: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* H1/H2 Period Performance Section */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Period Performance</h3>
        <div className="flex gap-2 mb-4 mt-2">
          <button
            onClick={() => setPeriodTab('current')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              periodTab === 'current' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isH2 ? `H2 (Oct ${year - 1} - Mar ${year})` : `H1 (Apr - Sep ${year})`}
          </button>
          <button
            onClick={() => setPeriodTab('previous')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              periodTab === 'previous' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isH2 ? `H1 (Apr - Sep ${year})` : `H2 (Oct ${year - 1} - Mar ${year})`}
          </button>
        </div>

        {activePeriodStats ? (
          <div>
            <p className="text-xs text-gray-500 mb-3">{activePeriodLabel}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Total Sales</div>
                <div className="text-sm font-bold text-gray-900">${activePeriodStats.totalSales.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Avg COGS%</div>
                <div className="text-sm font-bold text-gray-900">{activePeriodStats.avgCogsP.toFixed(1)}%</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Avg Wage%</div>
                <div className="text-sm font-bold text-gray-900">{activePeriodStats.avgWageP.toFixed(1)}%</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Total Profit</div>
                <div className="text-sm font-bold text-gray-900">${activePeriodStats.totalProfit.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Profit Margin</div>
                <div className="text-sm font-bold text-gray-900">{activePeriodStats.profitMargin.toFixed(1)}%</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {periodComparisons.map((c, i) => c.value !== null && (
                <div key={i} className={`text-xs font-medium px-2 py-1 rounded ${parseFloat(c.value) >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                  {parseFloat(c.value) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(c.value))}% {c.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No data for this period yet</p>
        )}
      </Card>

      {/* C. Monthly P&L Trend Table - with LY Sales column */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Monthly P&L Trend</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-gray-500 font-semibold">Month</th>
                <th className="px-3 py-3 text-right text-gray-500 font-semibold">Sales</th>
                <th className="px-3 py-3 text-right text-gray-400 font-semibold">LY Sales</th>
                <th className="px-3 py-3 text-right text-gray-500 font-semibold">COGS</th>
                <th className="px-3 py-3 text-right text-gray-500 font-semibold">COGS%</th>
                <th className="px-3 py-3 text-right text-gray-500 font-semibold">Wages</th>
                <th className="px-3 py-3 text-right text-gray-500 font-semibold">Wage%</th>
                <th className="px-3 py-3 text-right text-gray-500 font-semibold">Profit</th>
                <th className="px-3 py-3 text-right text-gray-500 font-semibold">Margin%</th>
              </tr>
            </thead>
            <tbody>
              {plData.map(d => (
                <tr key={d.label} className="border-b border-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-gray-700">{d.label}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">${fmt(d.sales)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-400">{d.lySales > 0 ? `$${fmt(d.lySales)}` : '-'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">${fmt(d.cogs)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${cogsGoal > 0 && parseFloat(d.cogsP) > cogsGoal ? 'text-red-600' : 'text-gray-600'}`}>{d.cogsP}%</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">${fmt(d.wages)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${wageGoal > 0 && parseFloat(d.wageP) > wageGoal ? 'text-red-600' : 'text-gray-600'}`}>{d.wageP}%</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">${fmt(d.profit)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${parseFloat(d.marginP) < 0 ? 'text-red-600' : 'text-gray-600'}`}>{d.marginP}%</td>
                </tr>
              ))}
              {/* Totals row */}
              {plData.length > 0 && (() => {
                const totSales = plData.reduce((s, d) => s + d.sales, 0)
                const totLySales = plData.reduce((s, d) => s + d.lySales, 0)
                const totCogs = plData.reduce((s, d) => s + d.cogs, 0)
                const totWages = plData.reduce((s, d) => s + d.wages, 0)
                const totProfit = plData.reduce((s, d) => s + d.profit, 0)
                const totExcl = monthsWithData.reduce((s, r) => s + (parseFloat(r.excl_gst_sales) || 0), 0)
                const totCogsP = totExcl > 0 ? (totCogs / totExcl * 100).toFixed(1) : '0.0'
                const totWageP = totExcl > 0 ? (totWages / totExcl * 100).toFixed(1) : '0.0'
                const totMarginP = totExcl > 0 ? (totProfit / totExcl * 100).toFixed(1) : '0.0'
                return (
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="px-4 py-2.5 text-gray-900">TOTAL</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">${fmt(totSales)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{totLySales > 0 ? `$${fmt(totLySales)}` : '-'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">${fmt(totCogs)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{totCogsP}%</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">${fmt(totWages)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{totWageP}%</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">${fmt(totProfit)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{totMarginP}%</td>
                  </tr>
                )
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      {/* D. KPI Trends */}
      {trendData.length > 1 && (
        <Card className="p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">KPI Trends</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <TrendMini label="Sales/Day" data={trendData.map(d => d.salesPerDay)} format="$" />
            <TrendMini label="COGS%" data={trendData.map(d => d.cogsP)} format="%" invertColor />
            <TrendMini label="Wage%" data={trendData.map(d => d.wageP)} format="%" invertColor />
            <TrendMini label="Profit Margin%" data={trendData.map(d => d.marginP)} format="%" />
          </div>
        </Card>
      )}
    </>
  )
}

// ===== TREND MINI SPARKLINE =====
function TrendMini({ label, data, format = '', invertColor = false }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 0.01)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const latest = data[data.length - 1]
  const first = data[0]
  const isUp = latest >= first
  const color = invertColor ? (!isUp ? 'bg-green-500' : 'bg-red-500') : (isUp ? 'bg-green-500' : 'bg-red-500')
  const textColor = invertColor ? (!isUp ? 'text-green-600' : 'text-red-600') : (isUp ? 'text-green-600' : 'text-red-600')

  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="flex items-end gap-px" style={{ height: 32 }}>
        {data.map((v, i) => {
          const h = range > 0 ? ((v - min) / range * 100) : 50
          return (
            <div
              key={i}
              className={`flex-1 rounded-t ${i === data.length - 1 ? color : 'bg-gray-300'}`}
              style={{ height: `${Math.max(h, 8)}%` }}
            />
          )
        })}
      </div>
      <div className={`text-sm font-bold mt-1.5 ${textColor}`}>
        {format === '$' ? `$${latest.toLocaleString('en-NZ', { maximumFractionDigits: 0 })}` : `${latest.toFixed(1)}%`}
      </div>
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

// ===== YOY BADGE =====
function YoyBadge({ value, label }) {
  if (value === null || value === undefined) return null
  const isUp = value > 0
  const color = isUp ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
  return (
    <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${color}`}>
      {isUp ? '▲' : '▼'} {Math.abs(value)}%
      {label && <span className="ml-1 text-gray-400">{label}</span>}
    </span>
  )
}

// ===== NZ MONTH CONTEXT =====
function getMonthContext(month) {
  const contexts = {
    1: { season: 'Summer Peak', desc: 'Summer peak season. School holidays continue. High tourist activity.', events: 'New Year\'s Day, Day after New Year\'s Day' },
    2: { season: 'Late Summer', desc: 'Late summer. Waitangi Day long weekend boost. Tourist flow still strong.', events: 'Waitangi Day (Feb 6)' },
    3: { season: 'Autumn Transition', desc: 'Autumn transition. Easter often falls here. Tourism starts to wind down.', events: 'Easter (varies), Otago Anniversary (Mar 23)' },
    4: { season: 'Autumn', desc: 'Autumn. ANZAC Day long weekend. Quieter period begins. School holidays.', events: 'ANZAC Day (Apr 25), School Holidays' },
    5: { season: 'Low Season', desc: 'Low season begins. Cooler weather, fewer tourists. Focus on locals.', events: '' },
    6: { season: 'Off-Peak', desc: 'Winter low season. Ski season starts late June. Queen\'s Birthday weekend.', events: 'Queen\'s Birthday (1st Mon), Ski Season Opens' },
    7: { season: 'Ski Season Peak', desc: 'Peak ski season! Queenstown/Wanaka tourist surge. School holidays.', events: 'Matariki, School Holidays, Ski Peak' },
    8: { season: 'Ski Season', desc: 'Ski season continues. Strong tourist activity in ski regions.', events: 'Ski Season' },
    9: { season: 'Late Winter', desc: 'Late winter. Ski season winding down. Spring approaching.', events: 'Ski Season Ends, School Holidays' },
    10: { season: 'Spring', desc: 'Spring. Labour Day long weekend. Business picks up gradually.', events: 'Labour Day (4th Mon)' },
    11: { season: 'Late Spring', desc: 'Late spring. Weather warming. Pre-Christmas activity starts.', events: 'Canterbury Anniversary (varies)' },
    12: { season: 'Summer Peak', desc: 'Summer peak. Christmas/NY rush. Maximum tourist and local activity.', events: 'Christmas Day, Boxing Day, School Holidays' },
  }
  return contexts[month] || { season: '', desc: '', events: '' }
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
  const yoy = r.yoy
  const kpis = r.kpis || {}
  const ctx = getMonthContext(r.month)

  return (
    <>
      {/* Month Context */}
      <Card className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-blue-900">{r.month_display} {r.year} Summary</h3>
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">{ctx.season}</span>
          </div>
          {kpis.profit_ratio !== undefined && (
            <div className={`text-right ${kpis.profit_ratio >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              <div className="text-2xl font-bold">{kpis.profit_ratio}%</div>
              <div className="text-xs text-gray-500">Profit Margin</div>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-2">{ctx.desc}</p>
        {ctx.events && <p className="text-xs text-blue-600 mt-1">📅 {ctx.events}</p>}
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-3 text-center">
          <div className="text-lg font-bold text-gray-900">${fmt(kpis.sales_per_day)}</div>
          <div className="text-xs text-gray-500">Daily Sales</div>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <div className="text-lg font-bold text-gray-900">${fmt(kpis.sales_per_tab)}</div>
          <div className="text-xs text-gray-500">Sales / Tab</div>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <div className="text-lg font-bold text-gray-900">${fmt(kpis.sales_per_labour_hour)}</div>
          <div className="text-xs text-gray-500">Sales / Labour Hr</div>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <div className="text-lg font-bold text-gray-900">${fmt(kpis.sales_per_opening_hour)}</div>
          <div className="text-xs text-gray-500">Sales / Opening Hr</div>
        </div>
      </div>

      {/* YoY Comparison */}
      {yoy && (
        <Card className="p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">YoY Comparison ({r.year - 1} → {r.year})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Sales</div>
              <YoyBadge value={yoy.sales} />
              <div className="text-xs text-gray-400 mt-1">${fmt(yoy.prev_sales)} → ${fmt(r.total_sales_inc_gst)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">COGS</div>
              <YoyBadge value={yoy.cogs} />
              <div className="text-xs text-gray-400 mt-1">${fmt(yoy.prev_cogs)} → ${fmt(r.cogs)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Labour</div>
              <YoyBadge value={yoy.labour} />
              <div className="text-xs text-gray-400 mt-1">${fmt(yoy.prev_labour)} → ${fmt(r.sales_per_hour)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Profit</div>
              <YoyBadge value={yoy.profit} />
              <div className="text-xs text-gray-400 mt-1">${fmt(yoy.prev_profit)} → ${fmt(r.operating_profit)}</div>
            </div>
          </div>
        </Card>
      )}

      {/* P&L Summary */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">P&L Summary</h3>
        <div className="space-y-1">
          <DetailRow label="" labelEn="Total Sales inc.GST" value={`$${fmt(r.total_sales_inc_gst)}`} highlight />
          <DetailRow label="" labelEn="EXCL GST" value={`$${fmt(r.excl_gst_sales)}`} />
          <DetailRow label="" labelEn="HQ CASH" value={`$${fmt(r.hq_cash)}`} />
          <div className="border-t border-gray-100 my-2" />
          <DetailRow label="" labelEn="COGS (excl.GST)" value={`$${fmt(r.cogs)}`} ratio={salesRatio('cogs')} />
          <DetailRow label="" labelEn="Operating Expenses" value={`$${fmt(r.operating_expenses)}`} ratio={salesRatio('operating_expenses')} />
          <DetailRow label="" labelEn="Total Labour" value={`$${fmt(r.sales_per_hour)}`} ratio={salesRatio('sales_per_hour')} />
          <div className="border-t border-gray-100 my-2" />
          <DetailRow label="" labelEn="Payable GST" value={`$${fmt(r.payable_gst)}`} />
          <DetailRow label="" labelEn="Operating Profit" value={`$${fmt(r.operating_profit)}`} ratio={`${kpis.profit_ratio || 0}%`} highlight />
        </div>
      </Card>

      {/* Input Data */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Input Data</h3>
        <div className="space-y-1">
          <DetailRow label="Auto" labelEn="Total Sales" value={`$${fmt(r.total_sales_garage)}`} />
          <DetailRow label="Auto" labelEn="HQ CASH" value={`$${fmt(r.hq_cash_garage)}`} />
          <div className="border-t border-gray-100 my-2" />
          <DetailRow label="Input" labelEn="COGS (excl.GST)" value={`$${fmt(r.total_cogs_xero)}`} />
          <DetailRow label="Input" labelEn="Total Expense" value={`$${fmt(r.total_expense_xero)}`} />
          <DetailRow label="Input" labelEn="Labour" value={`$${fmt(r.labour_xero)}`} />
          {parseFloat(r.sub_contractor_xero) > 0 && (
            <DetailRow label="Input" labelEn="Sub-contractor" value={`$${fmt(r.sub_contractor_xero)}`} />
          )}
          <DetailRow label="" labelEn="Trading Days" value={r.number_of_days || '-'} />
          <DetailRow label="" labelEn="Payruns" value={r.number_of_payruns || '-'} />
          <DetailRow label="" labelEn="Tabs" value={r.pos_sales > 0 ? r.pos_sales : '-'} />
          <DetailRow label="" labelEn="Total Work Hours" value={parseFloat(r.other_sales) > 0 ? r.other_sales + 'h' : '-'} />
          <DetailRow label="" labelEn="Opening Hours/Day" value={parseFloat(r.opening_hours_per_day) > 0 ? r.opening_hours_per_day + 'h' : '-'} />
        </div>
      </Card>

      {/* Goals & Review */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Goals & Review</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MiniKpi label="Sales Goal" value={`$${fmt(r.sales_goal)}`} />
          <MiniKpi label="COGS Goal" value={parseFloat(r.cogs_goal) > 0 ? `${r.cogs_goal}%` : '-'} />
          <MiniKpi label="Wage Goal" value={parseFloat(r.wage_goal) > 0 ? `${r.wage_goal}%` : '-'} />
          <MiniKpi label="Review Rating" value={r.review_rating > 0 ? r.review_rating : '-'} />
          <MiniKpi label="Total Reviews" value={r.review_goal > 0 ? r.review_goal : '-'} />
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Hygiene</div>
            {(() => {
              const g = r.hygiene_grade || ''
              const months = g === '18' ? 18 : g === '12' ? 12 : g === '6' ? 6 : 0
              const color = months >= 18 ? 'text-green-600 bg-green-100' : months >= 12 ? 'text-blue-600 bg-blue-100' : months >= 6 ? 'text-yellow-600 bg-yellow-100' : 'text-gray-600 bg-gray-100'
              return months > 0 ? (
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${color}`}>{months} months</span>
              ) : (
                <span className="text-sm font-bold text-gray-400">{g || '-'}</span>
              )
            })()}
          </div>
        </div>
      </Card>

      {/* Notes */}
      {(r.sales_notes || r.cogs_notes || r.wage_notes || r.next_month_notes) && (
        <Card className="p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Notes</h3>
          <div className="space-y-3">
            {r.sales_notes && <NoteBlock title="Sales" text={r.sales_notes} />}
            {r.cogs_notes && <NoteBlock title="COGS / Operating Expenses" text={r.cogs_notes} />}
            {r.wage_notes && <NoteBlock title="Wages" text={r.wage_notes} />}
            {r.next_month_notes && <NoteBlock title="Next Month Goals" text={r.next_month_notes} />}
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
        <p className="text-xs text-gray-400 mb-4">Auto-calculated from CSV upload data</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Total Sales (Auto)</label>
            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-right text-blue-700 font-medium">
              ${parseFloat(form.total_sales_garage || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <label className={labelCls}>HQ CASH (Auto)</label>
            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-right text-blue-700 font-medium">
              ${parseFloat(form.hq_cash_garage || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <label className={labelCls}>Trading Days (Auto)</label>
            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-right text-blue-700 font-medium">
              {form.number_of_days || 0}
            </div>
          </div>
        </div>
      </Card>

      {/* Manager Input */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Manager Input</h3>
        <p className="text-xs text-gray-400 mb-4">Manager manual input fields</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumField label="COGS (excl.GST)" value={form.total_cogs_xero} onChange={v => updateField('total_cogs_xero', v)} prefix="$" />
            <NumField label="Total Expense" value={form.total_expense_xero} onChange={v => updateField('total_expense_xero', v)} prefix="$" />
            <NumField label="Labour" value={form.labour_xero} onChange={v => updateField('labour_xero', v)} prefix="$" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumField label="Sub-contractor" value={form.sub_contractor_xero} onChange={v => updateField('sub_contractor_xero', v)} prefix="$" />
            <div>
              <label className={labelCls}>Number of Payruns</label>
              <input type="number" value={form.number_of_payruns} onChange={e => updateField('number_of_payruns', e.target.value)} className={inputCls} min="1" max="4" />
            </div>
            <div>
              <label className={labelCls}>Number of Tabs</label>
              <input type="number" value={form.pos_sales} onChange={e => updateField('pos_sales', e.target.value)} className={inputCls} min="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Total Work Hours</label>
              <input type="number" step="0.5" value={form.other_sales} onChange={e => updateField('other_sales', e.target.value)} className={inputCls} min="0" placeholder="e.g. 480" />
            </div>
            <div>
              <label className={labelCls}>Opening Hours/Day</label>
              <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-right text-blue-700 font-medium">
                {parseFloat(form.tab_allowance_sales || 0)}h (from store settings)
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Goals & Review</h3>
        <p className="text-xs text-gray-400 mb-4">Next month targets & review</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <NumField label="Sales Goal ($)" value={form.sales_goal} onChange={v => updateField('sales_goal', v)} prefix="$" />
          <NumField label="COGS Goal (%)" value={form.cogs_goal} onChange={v => updateField('cogs_goal', v)} suffix="%" />
          <NumField label="Wage Goal (%)" value={form.wage_goal} onChange={v => updateField('wage_goal', v)} suffix="%" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <NumField label="Reviews This Month" value={form.review_rating} onChange={v => updateField('review_rating', v)} />
          <NumField label="Total Reviews" value={form.review_goal} onChange={v => updateField('review_goal', v)} />
          <div>
            <label className={labelCls}>Hygiene Inspection Cycle</label>
            <select value={form.hygiene_grade} onChange={e => updateField('hygiene_grade', e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[['18', '18 months (Excellent)'], ['12', '12 months (Good)'], ['6', '6 months (Caution)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Notes</h3>
        <p className="text-xs text-gray-400 mb-4">Monthly observations and goals</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Sales Notes</label>
            <textarea value={form.sales_notes} onChange={e => updateField('sales_notes', e.target.value)}
              rows={3} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className={labelCls}>COGS / Expense Notes</label>
            <textarea value={form.cogs_notes} onChange={e => updateField('cogs_notes', e.target.value)}
              rows={3} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className={labelCls}>Wage Notes</label>
            <textarea value={form.wage_notes} onChange={e => updateField('wage_notes', e.target.value)}
              rows={3} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className={labelCls}>Next Month Goals</label>
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

// ===== CUSTOM VIEW (Range Selection + Comparison + AI) =====
function CustomView({ year }) {
  const now = new Date()
  const [fromYear, setFromYear] = useState(year)
  const [fromMonth, setFromMonth] = useState(1)
  const [toYear, setToYear] = useState(year)
  const [toMonth, setToMonth] = useState(now.getMonth() + 1)
  const [rangeData, setRangeData] = useState(null)
  const [rangeLoading, setRangeLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  const loadRange = async () => {
    setRangeLoading(true)
    setAiResult(null)
    try {
      const res = await skyReportAPI.rangeSummary(fromYear, fromMonth, toYear, toMonth)
      setRangeData(res.data)
    } catch { setRangeData(null) }
    finally { setRangeLoading(false) }
  }

  useEffect(() => { loadRange() }, [fromYear, fromMonth, toYear, toMonth])

  const runAiAnalysis = async () => {
    setAiLoading(true)
    try {
      const res = await skyReportAPI.aiAnalysis(fromYear, fromMonth, toYear, toMonth)
      setAiResult(res.data)
    } catch { setAiResult({ error: 'AI analysis failed. Please try again.' }) }
    finally { setAiLoading(false) }
  }

  const t = rangeData?.totals || {}
  const comp = rangeData?.comparison || {}
  const yoy1 = comp.yoy_1
  const yoy2 = comp.yoy_2

  const MonthPicker = ({ label, selYear, selMonth, onYearChange, onMonthChange }) => (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => onYearChange(selYear - 1)} className="p-1 hover:bg-gray-100 rounded text-gray-500 text-sm">←</button>
        <span className="text-sm font-bold text-gray-900 w-12 text-center">{selYear}</span>
        <button onClick={() => onYearChange(selYear + 1)} className="p-1 hover:bg-gray-100 rounded text-gray-500 text-sm">→</button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {MONTHS.map(m => (
          <button key={m.value} onClick={() => onMonthChange(m.value)}
            className={`px-2 py-1.5 rounded text-xs font-semibold transition ${
              selMonth === m.value ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* Range Picker */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Select Period</h3>
        <div className="grid grid-cols-2 gap-6">
          <MonthPicker label="FROM" selYear={fromYear} selMonth={fromMonth}
            onYearChange={setFromYear} onMonthChange={setFromMonth} />
          <MonthPicker label="TO" selYear={toYear} selMonth={toMonth}
            onYearChange={setToYear} onMonthChange={setToMonth} />
        </div>
        <div className="mt-3 text-center text-xs text-gray-400">
          {rangeData?.months_count || 0} months of data
        </div>
      </Card>

      {rangeLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rangeData && t.total_sales ? (
        <>
          {/* Aggregate KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiBox label="Total Sales" value={`$${fmt(t.total_sales)}`}
              sub={yoy1 ? `YoY ${yoy1.total_sales > 0 ? '▲' : '▼'}${Math.abs(yoy1.total_sales)}%` : null} />
            <KpiBox label="COGS" value={`$${fmt(t.cogs)}`} sub={`${t.cogs_ratio}%`} />
            <KpiBox label="Labour" value={`$${fmt(t.labour)}`} sub={`${t.labour_ratio}%`} />
            <KpiBox label="OP. Profit" value={`$${fmt(t.profit)}`} sub={`${t.profit_ratio}% margin`} />
          </div>

          {/* KPI Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiBox label="Sales/Day" value={`$${fmt(t.sales_per_day)}`} />
            <KpiBox label="Sales/Tab" value={t.sales_per_tab ? `$${fmt(t.sales_per_tab)}` : '-'} />
            <KpiBox label="Sales/Labour Hr" value={t.sales_per_labour_hr ? `$${fmt(t.sales_per_labour_hr)}` : '-'} />
            <KpiBox label="Sales/Opening Hr" value={t.sales_per_opening_hr ? `$${fmt(t.sales_per_opening_hr)}` : '-'} />
          </div>

          {/* Year-over-Year Comparison Table */}
          {(comp.prev_1 || comp.prev_2) && (
            <Card className="overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Year-over-Year Comparison</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-gray-500 font-semibold">Metric</th>
                      {comp.prev_2 && <th className="px-3 py-3 text-right text-gray-500 font-semibold">{fromYear - 2}</th>}
                      {comp.prev_1 && <th className="px-3 py-3 text-right text-gray-500 font-semibold">{fromYear - 1}</th>}
                      <th className="px-3 py-3 text-right text-blue-700 font-bold">{fromYear}</th>
                      {yoy1 && <th className="px-3 py-3 text-right text-gray-500 font-semibold">YoY</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Sales', key: 'total_sales', yoyKey: 'total_sales' },
                      { label: 'COGS', key: 'cogs', yoyKey: 'cogs' },
                      { label: 'Labour', key: 'labour', yoyKey: 'labour' },
                      { label: 'Profit', key: 'profit', yoyKey: 'profit' },
                    ].map(row => (
                      <tr key={row.key} className="border-b border-gray-50">
                        <td className="px-4 py-2.5 font-semibold text-gray-700">{row.label}</td>
                        {comp.prev_2 && <td className="px-3 py-2.5 text-right text-gray-500">${fmt(comp.prev_2.totals?.[row.key])}</td>}
                        {comp.prev_1 && <td className="px-3 py-2.5 text-right text-gray-600">${fmt(comp.prev_1.totals?.[row.key])}</td>}
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900">${fmt(t[row.key])}</td>
                        {yoy1 && (
                          <td className="px-3 py-2.5 text-right">
                            <YoyBadge value={yoy1[row.yoyKey]} />
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Ratio rows */}
                    {[
                      { label: 'COGS %', curr: t.cogs_ratio, p1: comp.prev_1?.totals?.cogs_ratio, p2: comp.prev_2?.totals?.cogs_ratio },
                      { label: 'Labour %', curr: t.labour_ratio, p1: comp.prev_1?.totals?.labour_ratio, p2: comp.prev_2?.totals?.labour_ratio },
                      { label: 'Profit %', curr: t.profit_ratio, p1: comp.prev_1?.totals?.profit_ratio, p2: comp.prev_2?.totals?.profit_ratio },
                    ].map(row => (
                      <tr key={row.label} className="border-b border-gray-50 bg-gray-50/50">
                        <td className="px-4 py-2 text-gray-500 text-xs">{row.label}</td>
                        {comp.prev_2 && <td className="px-3 py-2 text-right text-gray-400">{row.p2 || '-'}%</td>}
                        {comp.prev_1 && <td className="px-3 py-2 text-right text-gray-500">{row.p1 || '-'}%</td>}
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{row.curr || '-'}%</td>
                        {yoy1 && <td className="px-3 py-2"></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Monthly Breakdown Table */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Monthly Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">Month</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">Sales</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">COGS</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">Labour</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">Profit</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {(rangeData?.reports || []).map(r => {
                    const mLabel = MONTHS.find(m => m.value === r.month)?.label || r.month
                    const excl = parseFloat(r.excl_gst_sales) || 0
                    const prof = parseFloat(r.operating_profit) || 0
                    const margin = excl ? (prof / excl * 100).toFixed(1) : '0'
                    return (
                      <tr key={`${r.year}-${r.month}`} className="border-b border-gray-50">
                        <td className="px-4 py-2.5 font-semibold text-gray-700">{mLabel} {r.year}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">${fmt(r.total_sales_inc_gst)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">${fmt(r.cogs)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">${fmt(r.sales_per_hour)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">${fmt(r.operating_profit)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-500">{margin}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* AI Analysis */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">🤖 AI Analysis</h3>
              <button onClick={runAiAnalysis} disabled={aiLoading}
                className="px-4 py-2 text-xs font-semibold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition">
                {aiLoading ? 'Analyzing...' : aiResult ? 'Re-analyze' : 'Analyze with AI'}
              </button>
            </div>

            {aiLoading && (
              <div className="flex items-center justify-center py-8 gap-3">
                <div className="w-5 h-5 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Analyzing P&L data...</span>
              </div>
            )}

            {aiResult && !aiResult.error && (
              <div className="space-y-4">
                {/* Executive Summary */}
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-purple-700 mb-1">Executive Summary</p>
                  <p className="text-sm text-gray-800">{aiResult.executive_summary}</p>
                </div>

                {/* Highlights */}
                {aiResult.highlights?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500">Key Findings</p>
                    {aiResult.highlights.map((h, i) => (
                      <div key={i} className={`p-3 rounded-xl text-sm ${
                        h.type === 'positive' ? 'bg-green-50 text-green-800 border border-green-200' :
                        h.type === 'negative' ? 'bg-red-50 text-red-800 border border-red-200' :
                        'bg-gray-50 text-gray-800 border border-gray-200'
                      }`}>
                        {h.type === 'positive' ? '✅ ' : h.type === 'negative' ? '⚠️ ' : 'ℹ️ '}{h.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {aiResult.recommendations?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Recommendations</p>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                      {aiResult.recommendations.map((r, i) => (
                        <p key={i} className="text-sm text-blue-900">
                          <span className="font-bold text-blue-600">{i + 1}.</span> {r}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trend Note */}
                {aiResult.trend_note && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Trend Analysis</p>
                    <p className="text-sm text-gray-700">{aiResult.trend_note}</p>
                  </div>
                )}
              </div>
            )}

            {aiResult?.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{aiResult.error}</div>
            )}

            {!aiLoading && !aiResult && (
              <p className="text-sm text-gray-400 text-center py-4">
                Click "Analyze with AI" to get insights on your P&L performance
              </p>
            )}
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-gray-400 text-sm">No data for selected period</p>
        </Card>
      )}
    </>
  )
}

// ===== SUB COMPONENTS =====
function NumField({ label, value, onChange, prefix = '', suffix = '' }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{prefix}</span>}
        <input type="number" step="0.01" value={value} onChange={e => onChange(e.target.value)}
          className={`${inputCls} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-7' : ''}`} placeholder="0.00" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
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

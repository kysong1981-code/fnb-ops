import { useState, useEffect } from 'react'
import { salesAnalysisAPI, reportsAPI } from '../../services/api'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'
import SalesCharts from '../reports/SalesCharts'
import AIInsightsCard from '../reports/AIInsightsCard'

const fmt = (v) =>
  `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtInt = (v) =>
  parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmtNum = (v) =>
  parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const fmtPct = (v) => `${parseFloat(v || 0).toFixed(1)}%`

const fmtDate = (d) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

export default function StoreAnalysis({ startDate, endDate, organizationId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, organizationId])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { start_date: startDate, end_date: endDate }
      if (organizationId) params.organization_id = organizationId
      const [salesRes, chartRes] = await Promise.all([
        salesAnalysisAPI.getStoreAnalysis(params),
        reportsAPI.getChartData(startDate, endDate).catch(() => ({ data: { days: [] } })),
      ])
      setData(salesRes.data)
      setChartData(chartRes.data.days || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load store analysis.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
        {error}
      </div>
    )
  }

  if (!data) return null

  const { kpis, breakdown, data: daily } = data

  return (
    <div className="space-y-6">
      {/* Store name */}
      {data.organization && (
        <p className="text-sm font-medium text-gray-500">
          {data.organization.name}
        </p>
      )}

      {/* KPI Cards — Row 1: Sales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCardWithComparison
          label="Total Sales"
          value={fmt(kpis.total_sales)}
          prevMonth={kpis.prev_month_pct}
          prevMonthLabel={kpis.prev_month_total ? fmt(kpis.prev_month_total) : null}
          lastYear={kpis.last_year_pct}
          lastYearLabel={kpis.last_year_total ? fmt(kpis.last_year_total) : null}
          targetPct={kpis.target_pct}
          targetLabel={kpis.monthly_target ? fmt(kpis.monthly_target) : null}
        />
        <KpiCardWithComparison
          label="Avg Daily"
          value={fmt(kpis.avg_daily)}
          sub={`${kpis.days_with_data} days`}
          prevMonth={kpis.prev_month_avg_daily ? calcPct(kpis.avg_daily, kpis.prev_month_avg_daily) : null}
          prevMonthLabel={kpis.prev_month_avg_daily ? fmt(kpis.prev_month_avg_daily) : null}
          lastYear={kpis.last_year_avg_daily ? calcPct(kpis.avg_daily, kpis.last_year_avg_daily) : null}
          lastYearLabel={kpis.last_year_avg_daily ? fmt(kpis.last_year_avg_daily) : null}
        />
        <KpiCardWithComparison
          label="Transactions"
          value={fmtInt(kpis.total_transactions)}
          sub={kpis.avg_ticket ? `Avg ${fmt(kpis.avg_ticket)}` : undefined}
          prevMonth={kpis.prev_month_transactions ? calcPct(kpis.total_transactions, kpis.prev_month_transactions) : null}
          prevMonthLabel={kpis.prev_month_transactions ? fmtInt(kpis.prev_month_transactions) : null}
          lastYear={kpis.last_year_transactions ? calcPct(kpis.total_transactions, kpis.last_year_transactions) : null}
          lastYearLabel={kpis.last_year_transactions ? fmtInt(kpis.last_year_transactions) : null}
        />
        <KpiCardWithComparison
          label="SPLH"
          value={fmt(kpis.splh)}
          sub="Sales per Labor Hour"
          prevMonth={kpis.prev_month_splh ? calcPct(kpis.splh, kpis.prev_month_splh) : null}
          prevMonthLabel={kpis.prev_month_splh ? fmt(kpis.prev_month_splh) : null}
          lastYear={kpis.last_year_splh ? calcPct(kpis.splh, kpis.last_year_splh) : null}
          lastYearLabel={kpis.last_year_splh ? fmt(kpis.last_year_splh) : null}
        />
      </div>

      {/* KPI Cards — Row 2: Labor & Efficiency */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCardWithComparison
          label="Labor Hours"
          value={fmtNum(kpis.total_labor_hours)}
          sub={`${kpis.headcount || 0} staff`}
          prevMonth={kpis.prev_month_labor_hours ? calcPct(kpis.total_labor_hours, kpis.prev_month_labor_hours) : null}
          prevMonthLabel={kpis.prev_month_labor_hours ? fmtNum(kpis.prev_month_labor_hours) + 'h' : null}
          lastYear={kpis.last_year_labor_hours ? calcPct(kpis.total_labor_hours, kpis.last_year_labor_hours) : null}
          lastYearLabel={kpis.last_year_labor_hours ? fmtNum(kpis.last_year_labor_hours) + 'h' : null}
        />
        <KpiCardWithComparison
          label="Labor Cost"
          value={fmt(kpis.total_labor_cost)}
          sub={kpis.labor_pct ? `${kpis.labor_pct}% of sales` : undefined}
          prevMonth={kpis.prev_month_labor_cost ? calcPct(kpis.total_labor_cost, kpis.prev_month_labor_cost) : null}
          prevMonthLabel={kpis.prev_month_labor_cost ? fmt(kpis.prev_month_labor_cost) : null}
          lastYear={kpis.last_year_labor_cost ? calcPct(kpis.total_labor_cost, kpis.last_year_labor_cost) : null}
          lastYearLabel={kpis.last_year_labor_cost ? fmt(kpis.last_year_labor_cost) : null}
          targetPct={kpis.labour_target ? (kpis.labor_pct <= kpis.labour_target ? 100 : Math.round((kpis.labour_target / kpis.labor_pct) * 100)) : null}
          targetLabel={kpis.labour_target ? `Target: ${kpis.labour_target}%` : null}
          alert={kpis.labor_pct > 35 ? 'High' : undefined}
        />
        <KpiCardWithComparison
          label="Sales / Op Hour"
          value={fmt(kpis.sales_per_op_hour)}
          sub={kpis.daily_op_hours ? `${kpis.daily_op_hours}h/day open` : undefined}
          prevMonth={kpis.prev_month_sales_per_op_hour ? calcPct(kpis.sales_per_op_hour, kpis.prev_month_sales_per_op_hour) : null}
          prevMonthLabel={kpis.prev_month_sales_per_op_hour ? fmt(kpis.prev_month_sales_per_op_hour) : null}
        />
        <KpiCardWithComparison
          label="Target Progress"
          value={kpis.target_pct ? `${kpis.target_pct}%` : 'Not Set'}
          sub={kpis.monthly_target ? `Goal: ${fmt(kpis.monthly_target)}` : 'Set monthly target in settings'}
          alert={kpis.target_pct && kpis.target_pct < 50 ? 'Behind' : undefined}
          isProgress
          progressPct={kpis.target_pct}
        />
      </div>

      {/* Labor Cost % Indicator */}
      {kpis.labor_pct > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Labor Cost % vs Target</p>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${kpis.labor_pct <= 30 ? 'text-emerald-600' : kpis.labor_pct <= 35 ? 'text-amber-500' : 'text-red-600'}`}>
                {fmtPct(kpis.labor_pct)}
              </span>
              {kpis.prev_month_labor_pct > 0 && (
                <span className="text-xs text-gray-400">
                  (Last month: {fmtPct(kpis.prev_month_labor_pct)})
                </span>
              )}
            </div>
          </div>
          <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden relative">
            {/* Target line */}
            {kpis.labour_target && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gray-800 z-10"
                style={{ left: `${Math.min(kpis.labour_target, 50) * 2}%` }}
                title={`Target: ${kpis.labour_target}%`}
              />
            )}
            <div
              className={`h-full rounded-full transition-all ${
                kpis.labor_pct <= 30 ? 'bg-emerald-500' : kpis.labor_pct <= 35 ? 'bg-amber-400' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(kpis.labor_pct, 50) * 2}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-400">
            <span>0%</span>
            <span className="text-gray-600 font-semibold">Target: {kpis.labour_target || 30}%</span>
            <span>50%</span>
          </div>
        </Card>
      )}

      {/* Revenue Breakdown */}
      <SectionLabel>Revenue Breakdown</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Total Revenue Tree */}
        <Card className="p-5 lg:col-span-2">
          {/* Total Revenue header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{fmt(kpis.total_sales)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400">POS: {fmt((kpis.total_card || 0) + (kpis.total_cash || 0))}</p>
              {kpis.total_other > 0 && <p className="text-[10px] text-gray-400">Other: {fmt(kpis.total_other)}</p>}
            </div>
          </div>

          {/* Stacked bar */}
          <div className="h-10 rounded-xl overflow-hidden flex bg-gray-100 mb-3">
            {breakdown.card_pct > 0 && (
              <div className="bg-gray-900 h-full flex items-center justify-center" style={{ width: `${breakdown.card_pct}%` }}>
                {breakdown.card_pct > 10 && <span className="text-[10px] font-semibold text-white">Card {breakdown.card_pct}%</span>}
              </div>
            )}
            {breakdown.cash_pct > 0 && (
              <div className="bg-emerald-500 h-full flex items-center justify-center" style={{ width: `${breakdown.cash_pct}%` }}>
                {breakdown.cash_pct > 10 && <span className="text-[10px] font-semibold text-white">Cash {breakdown.cash_pct}%</span>}
              </div>
            )}
            {breakdown.other_pct > 0 && (
              <div className="bg-blue-400 h-full flex items-center justify-center" style={{ width: `${breakdown.other_pct}%` }}>
                {breakdown.other_pct > 8 && <span className="text-[10px] font-semibold text-white">Other {breakdown.other_pct}%</span>}
              </div>
            )}
          </div>

          {/* Tree breakdown */}
          <div className="space-y-2">
            {/* POS Sales */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-700">POS Sales</span>
                <span className="text-sm font-bold text-gray-900">{fmt((kpis.total_card || 0) + (kpis.total_cash || 0))}</span>
              </div>
              <div className="ml-4 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-gray-900" />Card</span>
                  <span className="font-medium text-gray-700">{fmt(kpis.total_card)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500" />Cash</span>
                  <span className="font-medium text-gray-700">{fmt(kpis.total_cash)}</span>
                </div>
              </div>
            </div>

            {/* Other Sales */}
            {breakdown.other_sales_by_name && breakdown.other_sales_by_name.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-blue-700">Other Sales</span>
                  <span className="text-sm font-bold text-blue-900">{fmt(kpis.total_other)}</span>
                </div>
                <div className="ml-4 space-y-1">
                  {breakdown.other_sales_by_name.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-blue-400" />{item.name}</span>
                      <span className="font-medium text-blue-700">{fmt(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Right: Channel Pie Chart (simple CSS) */}
        <Card className="p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Channel Mix</p>
          <div className="space-y-2">
            {[
              { name: 'Card', amount: kpis.total_card, color: 'bg-gray-900', textColor: 'text-gray-900' },
              { name: 'Cash', amount: kpis.total_cash, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
              ...(breakdown.other_sales_by_name || []).map(item => ({
                name: item.name, amount: item.total, color: 'bg-blue-400', textColor: 'text-blue-700',
              })),
            ].filter(c => c.amount > 0).map((ch, i) => {
              const pct = kpis.total_sales > 0 ? ((ch.amount / kpis.total_sales) * 100) : 0
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className={`font-medium ${ch.textColor}`}>{ch.name}</span>
                    <span className="text-gray-500">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${ch.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmt(ch.amount)}</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <SalesCharts
        chartData={chartData}
        salesData={{
          total_sales: kpis.total_sales || 0,
          card_total: kpis.total_card || 0,
          cash_total: kpis.total_cash || 0,
        }}
        dayOfWeekData={computeDayOfWeek(daily)}
      />

      {/* Holiday Analysis */}
      <HolidayAnalysis
        startDate={startDate}
        endDate={endDate}
        organizationId={organizationId}
      />

      {/* AI Insights */}
      <AIInsightsCard
        startDate={startDate}
        endDate={endDate}
        storeId={organizationId}
        useSalesAnalysisAPI
      />

      {/* Daily Detail Table */}
      <SectionLabel>Daily Detail</SectionLabel>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-900 bg-gray-100">Total</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Card</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Cash</th>
                <th className="text-right px-3 py-3 font-semibold text-blue-600">Other</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Tabs</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Hrs</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">SPLH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {daily.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{fmtDate(item.date)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-900 bg-gray-50">{fmt(item.total)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.card)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.cash)}</td>
                  <td className="px-3 py-2.5 text-right text-blue-600">{item.other > 0 ? fmt(item.other) : '-'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{item.tab_count || 0}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{fmtNum(item.labor_hours)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${item.splh >= (kpis.splh || 0) ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {fmt(item.splh)}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                <td className="px-3 py-2.5 text-gray-900">Total</td>
                <td className="px-3 py-2.5 text-right text-gray-900 bg-gray-200">{fmt(kpis.total_sales)}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.total_card)}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.total_cash)}</td>
                <td className="px-3 py-2.5 text-right text-blue-700">{fmt(kpis.total_other)}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{(kpis.total_transactions || 0).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{fmtNum(kpis.total_labor_hours)}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.splh)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function calcPct(current, prev) {
  if (!prev || prev === 0) return null
  return Math.round(((current - prev) / prev) * 100 * 10) / 10
}

function MiniCompare({ label, pct, detail }) {
  if (pct === null || pct === undefined) return null
  const isUp = pct >= 0
  const color = isUp ? 'text-emerald-600' : 'text-red-500'
  return (
    <div className="flex items-center justify-between" title={detail || ''}>
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className={`text-[10px] font-bold ${color}`}>
        {isUp ? '↑' : '↓'}{Math.abs(pct).toFixed(1)}%
      </span>
    </div>
  )
}

function TargetCompare({ pct, detail }) {
  if (pct === null || pct === undefined) return null
  const color = pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className="flex items-center justify-between" title={detail || ''}>
      <span className="text-[10px] text-gray-400">Target</span>
      <span className={`text-[10px] font-bold ${color}`}>
        {pct >= 100 ? '✓' : ''} {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function KpiCardWithComparison({ label, value, sub, prevMonth, prevMonthLabel, lastYear, lastYearLabel, targetPct, targetLabel, alert, isProgress, progressPct }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      {alert && (
        <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-semibold rounded-full border border-amber-200">
          {alert}
        </span>
      )}
      {/* Progress bar for Target Progress card */}
      {isProgress && progressPct != null && (
        <div className="mt-2">
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                progressPct >= 100 ? 'bg-emerald-500' : progressPct >= 70 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>
      )}
      {/* Mini comparisons */}
      {!isProgress && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
          <MiniCompare label="vs Last Month" pct={prevMonth} detail={prevMonthLabel} />
          <MiniCompare label="vs Last Year" pct={lastYear} detail={lastYearLabel} />
          <TargetCompare pct={targetPct} detail={targetLabel} />
        </div>
      )}
    </Card>
  )
}

const CATEGORY_LABELS = {
  NZ_PUBLIC: { label: 'NZ Public Holiday', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  NZ_SCHOOL: { label: 'School Holiday', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  CN_MAJOR: { label: 'Chinese Holiday', color: 'bg-red-100 text-red-700 border-red-200' },
  CN_FESTIVAL: { label: 'Chinese Festival', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  KR_MAJOR: { label: 'Korean Holiday', color: 'bg-green-100 text-green-700 border-green-200' },
  OTHER: { label: 'Other', color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

function HolidayAnalysis({ startDate, endDate, organizationId }) {
  const [holidays, setHolidays] = useState(null)
  const [upcoming, setUpcoming] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!startDate || !endDate) return
    setLoading(true)
    const params = { start_date: startDate, end_date: endDate }
    if (organizationId) params.organization_id = organizationId
    Promise.all([
      salesAnalysisAPI.getHolidays(params).catch(() => ({ data: null })),
      salesAnalysisAPI.getUpcomingHolidays(6).catch(() => ({ data: null })),
    ]).then(([hRes, uRes]) => {
      setHolidays(hRes.data)
      setUpcoming(uRes.data)
    }).finally(() => setLoading(false))
  }, [startDate, endDate, organizationId])

  if (loading) return null

  const hasHolidays = holidays?.holidays?.length > 0
  const hasUpcoming = upcoming?.upcoming?.length > 0
  if (!hasHolidays && !hasUpcoming) return null

  const sorted = hasHolidays ? [...holidays.holidays].sort((a, b) => new Date(a.start_date) - new Date(b.start_date)) : []

  return (
    <>
      <SectionLabel>Holidays</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Holiday Impact (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {hasHolidays && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">This Period&apos;s Holiday Impact</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sorted.map(h => {
                  const cat = CATEGORY_LABELS[h.category] || CATEGORY_LABELS.OTHER
                  const isPositive = h.impact_pct >= 0
                  return (
                    <Card key={h.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{h.name}</p>
                          {h.name_ko && <p className="text-xs text-gray-500">{h.name_ko}</p>}
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.color}`}>
                          {cat.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-3">
                        {h.start_date === h.end_date
                          ? new Date(h.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : `${new Date(h.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(h.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                        }
                      </p>
                      {h.days_with_data > 0 ? (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Total</p>
                            <p className="text-sm font-bold text-gray-900">{fmt(h.total_sales)}</p>
                            <p className="text-[10px] text-gray-400">{h.days_with_data} days</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Avg Daily</p>
                            <p className="text-sm font-bold text-gray-900">{fmt(h.avg_daily)}</p>
                            <p className="text-[10px] text-gray-400">vs {fmt(h.non_holiday_avg)} normal</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Impact</p>
                            <p className={`text-sm font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isPositive ? '↑' : '↓'} {Math.abs(h.impact_pct).toFixed(1)}%
                            </p>
                            <p className="text-[10px] text-gray-400">vs normal days</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No sales data for this period</p>
                      )}
                    </Card>
                  )
                })}
              </div>
            </>
          )}
          {!hasHolidays && (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-400">No holidays in selected period</p>
            </Card>
          )}
        </div>

        {/* Right: Upcoming Holidays (1 col) */}
        {hasUpcoming && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Upcoming Holidays</p>
            <Card className="p-4">
              <div className="space-y-3">
                {upcoming.upcoming.map(h => {
                  const cat = CATEGORY_LABELS[h.category] || CATEGORY_LABELS.OTHER
                  return (
                    <div key={h.id} className={`p-3 rounded-xl border ${h.is_ongoing ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-gray-900">{h.name_ko || h.name}</p>
                        {h.is_ongoing ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">NOW</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            D-{h.days_until}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-gray-500">
                          {new Date(h.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {h.duration > 1 && ` — ${new Date(h.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                          {h.duration > 1 && ` (${h.duration}days)`}
                        </p>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${cat.color}`}>
                          {cat.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}

function computeDayOfWeek(data) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const map = {}
  dayOrder.forEach(d => { map[d] = [] })
  for (const item of (data || [])) {
    if (!item.date) continue
    const dt = new Date(item.date + 'T00:00:00')
    const dayName = dayNames[dt.getDay()]
    map[dayName]?.push(parseFloat(item.total || 0))
  }
  return dayOrder.map(day => ({
    day,
    avg_sales: map[day].length > 0
      ? Math.round(map[day].reduce((a, b) => a + b, 0) / map[day].length)
      : 0,
  }))
}

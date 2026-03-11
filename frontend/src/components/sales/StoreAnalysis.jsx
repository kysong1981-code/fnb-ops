import { useState, useEffect } from 'react'
import { salesAnalysisAPI } from '../../services/api'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'

const fmt = (v) =>
  `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtNum = (v) =>
  parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

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

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, organizationId])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { start_date: startDate, end_date: endDate }
      if (organizationId) params.organization_id = organizationId
      const res = await salesAnalysisAPI.getStoreAnalysis(params)
      setData(res.data)
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
        <KpiCard label="Total Sales" value={fmt(kpis.total_sales)} />
        <KpiCard label="Avg Daily" value={fmt(kpis.avg_daily)} sub={`${kpis.days_with_data} days`} />
        <KpiCard label="Transactions" value={(kpis.total_transactions || 0).toLocaleString()} sub={kpis.avg_ticket ? `Avg ${fmt(kpis.avg_ticket)}` : undefined} />
        <KpiCard
          label="vs Prev Period"
          value={`${kpis.change_pct > 0 ? '↑' : kpis.change_pct < 0 ? '↓' : '—'} ${Math.abs(kpis.change_pct || 0).toFixed(1)}%`}
          sub={kpis.prev_period_total ? `Prev: ${fmt(kpis.prev_period_total)}` : undefined}
          alert={kpis.change_pct < -5 ? 'Declining' : undefined}
        />
      </div>

      {/* KPI Cards — Row 2: Labor & Efficiency */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="SPLH" value={fmt(kpis.splh)} sub="Sales per Labor Hour" />
        <KpiCard
          label="Labor Hours"
          value={fmtNum(kpis.total_labor_hours)}
          sub={`${kpis.headcount || 0} staff`}
        />
        <KpiCard
          label="Labor Cost"
          value={fmt(kpis.total_labor_cost)}
          sub={kpis.labor_pct ? `${kpis.labor_pct}% of sales` : undefined}
          alert={kpis.labor_pct > 35 ? 'High' : undefined}
        />
        <KpiCard
          label="Sales / Op Hour"
          value={fmt(kpis.sales_per_op_hour)}
          sub={kpis.daily_op_hours ? `${kpis.daily_op_hours}h/day open` : undefined}
        />
      </div>

      {/* Sales Breakdown */}
      <SectionLabel>Sales Breakdown</SectionLabel>
      <Card className="p-5">
        {/* Stacked bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-8 rounded-full overflow-hidden flex bg-gray-100">
            {breakdown.card_pct > 0 && (
              <div
                className="bg-gray-900 h-full flex items-center justify-center"
                style={{ width: `${breakdown.card_pct}%` }}
              >
                {breakdown.card_pct > 12 && (
                  <span className="text-[10px] font-semibold text-white">Card {breakdown.card_pct}%</span>
                )}
              </div>
            )}
            {breakdown.cash_pct > 0 && (
              <div
                className="bg-emerald-500 h-full flex items-center justify-center"
                style={{ width: `${breakdown.cash_pct}%` }}
              >
                {breakdown.cash_pct > 12 && (
                  <span className="text-[10px] font-semibold text-white">Cash {breakdown.cash_pct}%</span>
                )}
              </div>
            )}
            {breakdown.other_pct > 0 && (
              <div
                className="bg-blue-400 h-full flex items-center justify-center"
                style={{ width: `${breakdown.other_pct}%` }}
              >
                {breakdown.other_pct > 12 && (
                  <span className="text-[10px] font-semibold text-white">Other {breakdown.other_pct}%</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-900" />
            <span className="text-gray-600">Card</span>
            <span className="font-semibold text-gray-900">{fmt(kpis.total_card)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-gray-600">Cash</span>
            <span className="font-semibold text-gray-900">{fmt(kpis.total_cash)}</span>
          </div>
          {kpis.total_other > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-400" />
              <span className="text-gray-600">Other</span>
              <span className="font-semibold text-gray-900">{fmt(kpis.total_other)}</span>
            </div>
          )}
        </div>

        {/* Other sales detail */}
        {breakdown.other_sales_by_name && breakdown.other_sales_by_name.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Other Sales Detail</p>
            <div className="space-y-1">
              {breakdown.other_sales_by_name.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-600">{item.name}</span>
                  <span className="font-semibold text-gray-900">{fmt(item.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Daily Detail Table */}
      <SectionLabel>Daily Detail</SectionLabel>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Tabs</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Hrs</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">SPLH</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">$/Op Hr</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Card</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Cash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {daily.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{fmtDate(item.date)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(item.total)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{item.tab_count || 0}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{fmtNum(item.labor_hours)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${item.splh >= (kpis.splh || 0) ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {fmt(item.splh)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{fmt(item.sales_per_op_hour)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{fmt(item.card)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{fmt(item.cash)}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-2.5 text-gray-900">Total</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{fmt(kpis.total_sales)}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{(kpis.total_transactions || 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{fmtNum(kpis.total_labor_hours)}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{fmt(kpis.splh)}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{fmt(kpis.sales_per_op_hour)}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{fmt(kpis.total_card)}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{fmt(kpis.total_cash)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

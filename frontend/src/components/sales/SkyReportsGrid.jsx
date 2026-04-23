import { useState, useEffect, useMemo } from 'react'
import { skyReportAPI } from '../../services/api'
import Card from '../ui/Card'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtPct = (v) => `${parseFloat(v || 0).toFixed(1)}%`

export default function SkyReportsGrid({ year, month }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!year || !month) return
    setLoading(true)
    setError('')
    // Pass store_id='' to bypass the auto-added selected_store_id interceptor
    // so CEO/HQ/Regional Managers can see all accessible stores.
    skyReportAPI.list({ year, month, store_id: '' })
      .then((res) => {
        const data = res.data?.results || res.data || []
        setReports(Array.isArray(data) ? data : [])
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || 'Failed to load reports')
        setReports([])
      })
      .finally(() => setLoading(false))
  }, [year, month])

  const totals = useMemo(() => {
    const sum = (key) => reports.reduce((s, r) => s + parseFloat(r[key] || 0), 0)
    const total_sales = sum('total_sales_inc_gst')
    const excl_gst = sum('excl_gst_sales')
    const cogs = sum('cogs')
    const wages = sum('sales_per_hour')
    const op_exp = sum('operating_expenses')
    const op_profit = sum('operating_profit')
    return {
      total_sales, excl_gst, cogs, wages, op_exp, op_profit,
      cogs_ratio: excl_gst > 0 ? (cogs / excl_gst) * 100 : 0,
      wage_ratio: excl_gst > 0 ? (wages / excl_gst) * 100 : 0,
      profit_ratio: excl_gst > 0 ? (op_profit / excl_gst) * 100 : 0,
    }
  }, [reports])

  const monthLabel = useMemo(() => {
    if (!year || !month) return ''
    const d = new Date(year, month - 1, 1)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  }, [year, month])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
  }
  if (reports.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-400 text-sm">No Sky Reports for {monthLabel}</p>
      </Card>
    )
  }

  // Rank by Operating Profit (descending). Assign rank including ties.
  const sorted = [...reports].sort((a, b) =>
    parseFloat(b.operating_profit || 0) - parseFloat(a.operating_profit || 0)
  )
  const rankMedal = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{monthLabel}</h3>
            <p className="text-xs text-gray-400">{reports.length} store{reports.length !== 1 ? 's' : ''} reporting · ranked by Operating Profit</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total Sales (incl. GST)" value={fmt(totals.total_sales)} color="text-gray-900" />
          <Stat label="COGS" value={fmtPct(totals.cogs_ratio)} sub={fmt(totals.cogs)} color="text-amber-700" />
          <Stat label="Wages" value={fmtPct(totals.wage_ratio)} sub={fmt(totals.wages)} color="text-blue-700" />
          <Stat label="Operating Profit" value={fmtPct(totals.profit_ratio)} sub={fmt(totals.op_profit)} color="text-emerald-700" />
        </div>
      </Card>

      {/* Per-store table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500 text-xs">
                <th className="px-2 py-3 font-semibold text-center w-12">Rank</th>
                <th className="px-4 py-3 font-semibold">Store</th>
                <th className="px-3 py-3 font-semibold text-right">Total Sales</th>
                <th className="px-3 py-3 font-semibold text-right">Excl.GST</th>
                <th className="px-3 py-3 font-semibold text-right">COGS</th>
                <th className="px-3 py-3 font-semibold text-right">Wages</th>
                <th className="px-3 py-3 font-semibold text-right">Op.Exp</th>
                <th className="px-3 py-3 font-semibold text-right">Profit</th>
                <th className="px-3 py-3 font-semibold text-right">Days</th>
                <th className="px-3 py-3 font-semibold text-center">Lock</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === 0 ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-2 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                      {rankMedal(i) && <span className="text-base leading-none">{rankMedal(i)}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.organization_name || '-'}</td>
                  <td className="px-3 py-3 text-right text-gray-900 font-semibold">{fmt(r.total_sales_inc_gst)}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{fmt(r.excl_gst_sales)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="text-amber-700 font-medium">{fmtPct(r.cogs_ratio)}</div>
                    <div className="text-[10px] text-gray-400">{fmt(r.cogs)}</div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="text-blue-700 font-medium">{fmtPct(r.wage_ratio)}</div>
                    <div className="text-[10px] text-gray-400">{fmt(r.sales_per_hour)}</div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">{fmt(r.operating_expenses)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className={`font-bold ${parseFloat(r.operating_profit) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(r.operating_profit)}</div>
                    <div className={`text-[10px] ${parseFloat(r.kpis?.profit_ratio || 0) >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {fmtPct(r.kpis?.profit_ratio || 0)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-500">{r.number_of_days || '-'}</td>
                  <td className="px-3 py-3 text-center">
                    {r.is_locked ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">✓</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">Draft</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr className="font-semibold">
                <td className="px-2 py-3"></td>
                <td className="px-4 py-3 text-gray-800">Total ({reports.length})</td>
                <td className="px-3 py-3 text-right text-gray-900">{fmt(totals.total_sales)}</td>
                <td className="px-3 py-3 text-right text-gray-700">{fmt(totals.excl_gst)}</td>
                <td className="px-3 py-3 text-right">
                  <div className="text-amber-700">{fmtPct(totals.cogs_ratio)}</div>
                  <div className="text-[10px] text-gray-400">{fmt(totals.cogs)}</div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="text-blue-700">{fmtPct(totals.wage_ratio)}</div>
                  <div className="text-[10px] text-gray-400">{fmt(totals.wages)}</div>
                </td>
                <td className="px-3 py-3 text-right text-gray-700">{fmt(totals.op_exp)}</td>
                <td className="px-3 py-3 text-right">
                  <div className={`font-bold ${totals.op_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(totals.op_profit)}</div>
                  <div className={`text-[10px] ${totals.profit_ratio >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{fmtPct(totals.profit_ratio)}</div>
                </td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value, sub, color }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${color || 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

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

export default function RegionalAnalysis({ startDate, endDate, regionId, onDrillDown }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [sortKey, setSortKey] = useState('total_sales')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, regionId])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { start_date: startDate, end_date: endDate }
      if (regionId) params.region_id = regionId
      const res = await salesAnalysisAPI.getRegionalAnalysis(params)
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load regional analysis.')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
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

  const { kpis, stores, daily_totals } = data

  // Sort stores
  const sortedStores = [...(stores || [])].sort((a, b) => {
    const av = a[sortKey] || 0
    const bv = b[sortKey] || 0
    return sortAsc ? av - bv : bv - av
  })

  const maxSplh = Math.max(...(stores || []).map((s) => s.splh || 0), 1)
  const avgSplh = kpis.splh || 0

  const SortIcon = ({ col }) => (
    <span className="ml-0.5 text-[10px] text-gray-400">
      {sortKey === col ? (sortAsc ? '↑' : '↓') : ''}
    </span>
  )

  return (
    <div className="space-y-6">
      {/* Region name */}
      {data.region && (
        <p className="text-sm font-medium text-gray-500">
          {data.region.name}
        </p>
      )}

      {/* KPI Cards — Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Sales" value={fmt(kpis.total_sales)} />
        <KpiCard label="SPLH" value={fmt(kpis.splh)} sub="Sales per Labor Hour" />
        <KpiCard
          label="Labor Cost"
          value={fmt(kpis.total_labor_cost)}
          sub={kpis.labor_pct ? `${kpis.labor_pct}% of sales` : undefined}
          alert={kpis.labor_pct > 35 ? 'High' : undefined}
        />
        <KpiCard
          label="vs Prev Period"
          value={`${kpis.change_pct > 0 ? '↑' : kpis.change_pct < 0 ? '↓' : '—'} ${Math.abs(kpis.change_pct || 0).toFixed(1)}%`}
          sub={kpis.prev_period_total ? `Prev: ${fmt(kpis.prev_period_total)}` : undefined}
          alert={kpis.change_pct < -5 ? 'Declining' : undefined}
        />
      </div>

      {/* KPI Cards — Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Stores" value={kpis.store_count || 0} />
        <KpiCard label="Best Store" value={kpis.best_store?.name || '—'} />
        <KpiCard label="Labor Hours" value={fmtNum(kpis.total_labor_hours)} sub={`${kpis.headcount || 0} staff`} />
        <KpiCard label="Avg Ticket" value={fmt(kpis.avg_ticket)} />
      </div>

      {/* Store Comparison Table — the key comparison view */}
      <SectionLabel>Store Comparison</SectionLabel>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-3 font-semibold text-gray-600">#</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Store</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('total_sales')}>
                  Sales<SortIcon col="total_sales" />
                </th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('avg_daily')}>
                  Avg/Day<SortIcon col="avg_daily" />
                </th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('avg_ticket')}>
                  Avg Ticket<SortIcon col="avg_ticket" />
                </th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('labor_hours')}>
                  Hrs<SortIcon col="labor_hours" />
                </th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('splh')}>
                  SPLH<SortIcon col="splh" />
                </th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('labor_pct')}>
                  Labor%<SortIcon col="labor_pct" />
                </th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Staff</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleSort('sales_per_op_hour')}>
                  $/Op Hr<SortIcon col="sales_per_op_hour" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedStores.map((store, idx) => (
                <tr
                  key={store.organization?.id || idx}
                  className={`hover:bg-gray-50/50 transition ${onDrillDown ? 'cursor-pointer' : ''}`}
                  onClick={() => onDrillDown && onDrillDown('store', store.organization?.id)}
                >
                  <td className="px-3 py-2.5 text-gray-400 font-medium">{store.rank}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900">{store.organization?.name}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmt(store.total_sales)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{fmt(store.avg_daily)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{fmt(store.avg_ticket)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{fmtNum(store.labor_hours)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${(store.splh || 0) >= avgSplh ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {fmt(store.splh)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-medium ${(store.labor_pct || 0) > 35 ? 'text-red-600' : 'text-gray-700'}`}>
                    {(store.labor_pct || 0).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{store.headcount || 0}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{fmt(store.sales_per_op_hour)}</td>
                </tr>
              ))}
              {/* Totals */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-gray-900">Total</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.total_sales)}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.avg_daily)}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.avg_ticket)}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{fmtNum(kpis.total_labor_hours)}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.splh)}</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{(kpis.labor_pct || 0).toFixed(1)}%</td>
                <td className="px-3 py-2.5 text-right text-gray-900">{kpis.headcount}</td>
                <td className="px-3 py-2.5 text-right text-gray-900" />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* SPLH Comparison Bar */}
      <SectionLabel>SPLH Comparison</SectionLabel>
      <Card className="p-5">
        {sortedStores.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No data.</p>
        ) : (
          <div className="space-y-3">
            {[...sortedStores].sort((a, b) => (b.splh || 0) - (a.splh || 0)).map((store, idx) => {
              const pct = ((store.splh || 0) / maxSplh) * 100
              const isAboveAvg = (store.splh || 0) >= avgSplh
              return (
                <div
                  key={store.organization?.id || idx}
                  className={`flex items-center gap-3 ${onDrillDown ? 'cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition' : ''}`}
                  onClick={() => onDrillDown && onDrillDown('store', store.organization?.id)}
                >
                  <div className="w-24 text-sm font-medium text-gray-900 shrink-0 truncate">
                    {store.organization?.name || 'Unknown'}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-full h-7 overflow-hidden relative">
                      {/* Avg line */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                        style={{ left: `${(avgSplh / maxSplh) * 100}%` }}
                      />
                      <div
                        className={`${isAboveAvg ? 'bg-emerald-500' : 'bg-amber-500'} h-full rounded-full flex items-center justify-end pr-2.5 transition-all`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      >
                        {pct > 30 && (
                          <span className="text-[10px] font-semibold text-white">{fmt(store.splh)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-20 text-right shrink-0">
                    <p className={`text-xs font-semibold ${isAboveAvg ? 'text-emerald-600' : 'text-amber-600'}`}>{fmt(store.splh)}</p>
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-2">
              <span className="w-3 h-px bg-red-400" /> Avg SPLH: {fmt(avgSplh)}
            </div>
          </div>
        )}
      </Card>

      {/* Daily Trend */}
      <SectionLabel>Daily Trend</SectionLabel>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Hrs</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">SPLH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(daily_totals || []).map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{fmtDate(item.date)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(item.total)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{fmtNum(item.labor_hours)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${(item.splh || 0) >= avgSplh ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {fmt(item.splh)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

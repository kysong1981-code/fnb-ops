import { useState, useEffect } from 'react'
import { salesAnalysisAPI } from '../../services/api'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'
import AIInsightsCard from '../reports/AIInsightsCard'

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

export default function EnterpriseAnalysis({ startDate, endDate, onDrillDown }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [storeSort, setStoreSort] = useState('total_sales')
  const [storeSortAsc, setStoreSortAsc] = useState(false)
  const [viewMode, setViewMode] = useState('region') // 'region' | 'store'

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { start_date: startDate, end_date: endDate }
      const res = await salesAnalysisAPI.getEnterpriseAnalysis(params)
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load enterprise analysis.')
    } finally {
      setLoading(false)
    }
  }

  const handleStoreSort = (key) => {
    if (storeSort === key) {
      setStoreSortAsc(!storeSortAsc)
    } else {
      setStoreSort(key)
      setStoreSortAsc(false)
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

  const { kpis, regions, store_ranking, daily_totals } = data

  // Sort stores
  const sortedStores = [...(store_ranking || [])].sort((a, b) => {
    const av = a[storeSort] || 0
    const bv = b[storeSort] || 0
    return storeSortAsc ? av - bv : bv - av
  })

  const avgSplh = kpis.splh || 0
  const maxStoreSplh = Math.max(...(store_ranking || []).map((s) => s.splh || 0), 1)

  const SortIcon = ({ col }) => (
    <span className="ml-0.5 text-[10px] text-gray-400">
      {storeSort === col ? (storeSortAsc ? '↑' : '↓') : ''}
    </span>
  )

  return (
    <div className="space-y-6">
      {/* KPI Cards — Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Sales" value={fmt(kpis.total_sales)} sub={`${kpis.store_count || 0} stores`} />
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
        <KpiCard label="Avg Daily" value={fmt(kpis.avg_daily)} sub={`${kpis.days_with_data} days`} />
        <KpiCard label="Avg Ticket" value={fmt(kpis.avg_ticket)} />
        <KpiCard label="Labor Hours" value={fmtNum(kpis.total_labor_hours)} sub={`${kpis.headcount || 0} staff`} />
        <KpiCard label="Best Region" value={kpis.best_region?.name || '—'} />
      </div>

      {/* Toggle: Region vs All-Store View */}
      <div className="flex items-center gap-2">
        <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
          <button
            onClick={() => setViewMode('region')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              viewMode === 'region' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            By Region
          </button>
          <button
            onClick={() => setViewMode('store')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              viewMode === 'store' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            All Stores
          </button>
        </div>
      </div>

      {viewMode === 'region' ? (
        <>
          {/* Region Comparison Table */}
          <SectionLabel>Region Comparison</SectionLabel>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">#</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Region</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Stores</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Sales</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Avg/Day</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Avg Ticket</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Hrs</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">SPLH</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Labor%</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(regions || []).map((region, idx) => (
                    <tr
                      key={region.organization?.id || idx}
                      className={`hover:bg-gray-50/50 transition ${onDrillDown ? 'cursor-pointer' : ''}`}
                      onClick={() => onDrillDown && onDrillDown('regional', region.organization?.id)}
                    >
                      <td className="px-3 py-2.5 text-gray-400 font-medium">{region.rank}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">{region.organization?.name}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{region.store_count}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmt(region.total_sales)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmt(region.avg_daily)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmt(region.avg_ticket)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{fmtNum(region.labor_hours)}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${(region.splh || 0) >= avgSplh ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {fmt(region.splh)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-medium ${(region.labor_pct || 0) > 35 ? 'text-red-600' : 'text-gray-700'}`}>
                        {(region.labor_pct || 0).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{region.headcount || 0}</td>
                    </tr>
                  ))}
                  {/* Totals */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-gray-900">Total</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{kpis.store_count}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.total_sales)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.avg_daily)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.avg_ticket)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{fmtNum(kpis.total_labor_hours)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{fmt(kpis.splh)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{(kpis.labor_pct || 0).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{kpis.headcount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <>
          {/* All-Store Comparison Table */}
          <SectionLabel>All-Store Comparison</SectionLabel>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">#</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Store</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleStoreSort('total_sales')}>
                      Sales<SortIcon col="total_sales" />
                    </th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleStoreSort('avg_daily')}>
                      Avg/Day<SortIcon col="avg_daily" />
                    </th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleStoreSort('avg_ticket')}>
                      Avg Ticket<SortIcon col="avg_ticket" />
                    </th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleStoreSort('labor_hours')}>
                      Hrs<SortIcon col="labor_hours" />
                    </th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleStoreSort('splh')}>
                      SPLH<SortIcon col="splh" />
                    </th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleStoreSort('labor_pct')}>
                      Labor%<SortIcon col="labor_pct" />
                    </th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Staff</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleStoreSort('sales_per_op_hour')}>
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
                  const pct = ((store.splh || 0) / maxStoreSplh) * 100
                  const isAboveAvg = (store.splh || 0) >= avgSplh
                  return (
                    <div
                      key={store.organization?.id || idx}
                      className={`flex items-center gap-3 ${onDrillDown ? 'cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition' : ''}`}
                      onClick={() => onDrillDown && onDrillDown('store', store.organization?.id)}
                    >
                      <div className="w-24 text-xs font-medium text-gray-900 shrink-0 truncate">
                        {store.organization?.name}
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-100 rounded-full h-7 overflow-hidden relative">
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                            style={{ left: `${(avgSplh / maxStoreSplh) * 100}%` }}
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
        </>
      )}

      {/* AI Insights */}
      <AIInsightsCard
        startDate={data?.start_date || ''}
        endDate={data?.end_date || ''}
        storeId={null}
        useSalesAnalysisAPI
      />

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

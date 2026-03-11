import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'

export default function SalesPerformanceReport({ data }) {
  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtDate = (d) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return d
    }
  }

  if (!data) return null
  const { period, statistics, performance_data } = data
  const maxSales = Math.max(...performance_data.map(i => i.total || 0), 1)

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <SectionLabel>Performance Stats</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Sales" value={fmt(statistics.total)} />
        <KpiCard label="Average" value={fmt(statistics.average)} />
        <KpiCard label="Highest" value={fmt(statistics.max)} />
        <KpiCard label="Lowest" value={fmt(statistics.min)} />
        <KpiCard
          label="Trend"
          value={statistics.trend === 'up' ? '↑ Up' : '↓ Down'}
          alert={statistics.trend === 'down' ? 'Declining' : undefined}
        />
      </div>

      {/* Chart */}
      <SectionLabel>Daily Sales</SectionLabel>
      <Card className="p-5">
        {performance_data.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No data available.</p>
        ) : (
          <div className="space-y-2.5">
            {performance_data.map((item, idx) => {
              const pct = (item.total / maxSales) * 100
              const label = period === 'monthly' ? item.period : fmtDate(item.period || item.date)
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-16 text-xs font-medium text-gray-400 text-right shrink-0">
                    {label}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-full h-7 overflow-hidden">
                      <div
                        className="bg-gray-900 h-full rounded-full flex items-center justify-end pr-2.5 transition-all"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      >
                        {pct > 25 && (
                          <span className="text-[10px] font-semibold text-white">{fmt(item.total)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <p className="text-xs font-semibold text-gray-900">{fmt(item.total)}</p>
                    <p className="text-[10px] text-gray-400">{item.count} txns</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Best / Worst */}
      {performance_data.length > 0 && (
        <>
          <SectionLabel>Performance Comparison</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            {(() => {
              const best = performance_data.reduce((a, b) => a.total > b.total ? a : b)
              const worst = performance_data.reduce((a, b) => a.total < b.total ? a : b)
              return (
                <>
                  <KpiCard
                    label="Best Day"
                    value={fmt(best.total)}
                    sub={`${fmtDate(best.period || best.date)} · ${best.count} txns`}
                  />
                  <KpiCard
                    label="Worst Day"
                    value={fmt(worst.total)}
                    sub={`${fmtDate(worst.period || worst.date)} · ${worst.count} txns`}
                    alert="Lowest"
                  />
                </>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}

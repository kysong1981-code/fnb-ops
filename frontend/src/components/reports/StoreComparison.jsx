import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import Badge from '../ui/Badge'
import SectionLabel from '../ui/SectionLabel'

export default function StoreComparison({ data }) {
  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (!data || !data.stores) return null
  const { stores } = data
  const totalStores = stores.length
  const totalClosing = stores.reduce((s, st) => s + st.closing_actual_total, 0)
  const totalSales = stores.reduce((s, st) => s + st.sales_total, 0)

  return (
    <div className="space-y-6">
      {/* Summary KPI */}
      <SectionLabel>Summary</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Stores" value={totalStores} />
        <KpiCard label="Closing Total" value={fmt(totalClosing)} />
        <KpiCard label="Sales Total" value={fmt(totalSales)} />
        <KpiCard label="Avg. Sales" value={fmt(totalSales / Math.max(totalStores, 1))} />
      </div>

      {/* Comparison Table */}
      <SectionLabel>Store Comparison</SectionLabel>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-widest">Store</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-widest">POS</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-widest">Actual</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-widest">Variance</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-widest">Sales</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-widest">Txns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stores.map((store, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{store.organization}</td>
                  <td className="px-5 py-3.5 text-sm text-right text-gray-700">{fmt(store.closing_pos_total)}</td>
                  <td className="px-5 py-3.5 text-sm text-right text-gray-700">{fmt(store.closing_actual_total)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {store.closing_variance === 0 ? (
                      <Badge variant="success">Match</Badge>
                    ) : store.closing_variance < 0 ? (
                      <Badge variant="danger">{fmt(store.closing_variance)}</Badge>
                    ) : (
                      <Badge variant="warning">+{fmt(store.closing_variance)}</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-right font-medium text-emerald-600">{fmt(store.sales_total)}</td>
                  <td className="px-5 py-3.5 text-sm text-right text-gray-500">{store.sales_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

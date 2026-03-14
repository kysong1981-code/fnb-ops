import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, PieChart, Pie, Cell,
} from 'recharts'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'

const COLORS = {
  blue: '#3b82f6',
  green: '#10b981',
  purple: '#8b5cf6',
  gray: '#9ca3af',
  card: '#3b82f6',
  cash: '#10b981',
}

const DOW_COLORS = {
  Mon: '#3b82f6', Tue: '#3b82f6', Wed: '#3b82f6', Thu: '#3b82f6',
  Fri: '#3b82f6', Sat: '#8b5cf6', Sun: '#8b5cf6',
}

const fmt = (v) =>
  `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtShort = (v) => {
  const n = parseFloat(v || 0)
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export default function SalesCharts({ chartData, salesData, dayOfWeekData }) {
  return (
    <div className="space-y-4">
      {/* Daily Sales Trend */}
      {chartData && chartData.length > 0 && (
        <>
          <SectionLabel>Daily Sales Trend</SectionLabel>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Sales vs Last Year</h3>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.blue }} />
                  <span className="text-gray-500">This Year</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 border-t-2 border-dashed" style={{ borderColor: COLORS.gray }} />
                  <span className="text-gray-500">Last Year</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px', border: '1px solid #e5e7eb',
                    fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value, name) => [fmt(value), name === 'sales' ? 'This Year' : 'Last Year']}
                />
                <Bar dataKey="sales" fill={COLORS.blue} radius={[4, 4, 0, 0]} barSize={28} name="sales" />
                <Line
                  dataKey="ly_sales" stroke={COLORS.gray} strokeWidth={2}
                  strokeDasharray="5 5" dot={{ r: 3, fill: COLORS.gray }} name="ly_sales"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* Two-column: Day of Week + Card vs Cash */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Day of Week Analysis */}
        {dayOfWeekData && dayOfWeekData.length > 0 && (
          <div>
            <SectionLabel>Day of Week Pattern</SectionLabel>
            <Card className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dayOfWeekData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={fmtShort}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px', border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [fmt(value), 'Avg Sales']}
                  />
                  <Bar dataKey="avg_sales" radius={[6, 6, 0, 0]} barSize={36}>
                    {dayOfWeekData.map((entry, i) => (
                      <Cell key={i} fill={DOW_COLORS[entry.day] || COLORS.blue} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 justify-center text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-blue-500" />
                  <span>Weekday</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-violet-500" />
                  <span>Weekend</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Card vs Cash */}
        {salesData && (salesData.card_total > 0 || salesData.cash_total > 0) && (
          <div>
            <SectionLabel>Card vs Cash</SectionLabel>
            <Card className="p-4">
              <CardCashPie card={salesData.card_total} cash={salesData.cash_total} total={salesData.total_sales} />
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function CardCashPie({ card, cash, total }) {
  const data = [
    { name: 'Card', value: card, color: COLORS.card },
    { name: 'Cash', value: cash, color: COLORS.cash },
  ]
  const cardPct = total > 0 ? ((card / total) * 100).toFixed(1) : 0
  const cashPct = total > 0 ? ((cash / total) * 100).toFixed(1) : 0

  return (
    <div className="flex items-center justify-center gap-6">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            formatter={(value) => [fmt(value)]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.card }} />
            <span className="text-sm font-semibold text-gray-900">Card</span>
          </div>
          <p className="text-lg font-bold text-gray-900 ml-5">{fmt(card)}</p>
          <p className="text-xs text-gray-500 ml-5">{cardPct}%</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.cash }} />
            <span className="text-sm font-semibold text-gray-900">Cash</span>
          </div>
          <p className="text-lg font-bold text-gray-900 ml-5">{fmt(cash)}</p>
          <p className="text-xs text-gray-500 ml-5">{cashPct}%</p>
        </div>
      </div>
    </div>
  )
}

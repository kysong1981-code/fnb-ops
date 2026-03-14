import { useState, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { reportsAPI } from '../../services/api'
import Card from '../ui/Card'

const COLORS = {
  sales: '#3b82f6',
  qty: '#10b981',
  labour: '#6366f1',
  cogs: '#f59e0b',
  lastYear: '#9ca3af',
}

const fmt = (v) =>
  `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function ChartCard({ title, data, barKey, lineKey, color, formatter, unit }) {
  if (!data || data.length === 0) return null

  const barTotal = data.reduce((sum, d) => sum + (d[barKey] || 0), 0)
  const lineTotal = data.reduce((sum, d) => sum + (d[lineKey] || 0), 0)
  const diff = lineTotal > 0 ? ((barTotal - lineTotal) / lineTotal * 100).toFixed(1) : null

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-gray-900">{formatter(barTotal)}</span>
          {diff !== null && lineTotal > 0 && (
            <span className={`font-medium ${parseFloat(diff) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {parseFloat(diff) >= 0 ? '+' : ''}{diff}%
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
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
            tickFormatter={(v) => unit === '$' ? `$${(v / 1000).toFixed(0)}k` : v}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
            formatter={(value, name) => {
              const label = name === barKey ? 'This Year' : 'Last Year'
              return [formatter(value), label]
            }}
          />
          <Bar
            dataKey={barKey}
            fill={color}
            radius={[4, 4, 0, 0]}
            barSize={28}
            name={barKey}
          />
          <Line
            dataKey={lineKey}
            stroke={COLORS.lastYear}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: COLORS.lastYear }}
            name={lineKey}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
          <span className="text-xs text-gray-500">This Year</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 border-t-2 border-dashed" style={{ borderColor: COLORS.lastYear }} />
          <span className="text-xs text-gray-500">Last Year</span>
        </div>
      </div>
    </Card>
  )
}

export default function DailyCharts({ startDate, endDate }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (startDate && endDate) fetchData()
  }, [startDate, endDate])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await reportsAPI.getChartData(startDate, endDate)
      setData(res.data.days || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load chart data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="p-5 text-center text-gray-400 text-sm">
        No chart data available for this period
      </Card>
    )
  }

  const fmtNum = (v) => parseFloat(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
  const fmtHours = (v) => `${parseFloat(v || 0).toFixed(1)}h`

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartCard
        title="Sales"
        data={data}
        barKey="sales"
        lineKey="ly_sales"
        color={COLORS.sales}
        formatter={fmt}
        unit="$"
      />
      <ChartCard
        title="QTY"
        data={data}
        barKey="qty"
        lineKey="ly_qty"
        color={COLORS.qty}
        formatter={fmtNum}
        unit=""
      />
      <ChartCard
        title="Labour Hours"
        data={data}
        barKey="labour_hours"
        lineKey="ly_labour_hours"
        color={COLORS.labour}
        formatter={fmtHours}
        unit=""
      />
      <ChartCard
        title="COGS"
        data={data}
        barKey="cogs"
        lineKey="ly_cogs"
        color={COLORS.cogs}
        formatter={fmt}
        unit="$"
      />
    </div>
  )
}

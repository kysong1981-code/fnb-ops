import { useState, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, LineChart,
  PieChart, Pie, Cell, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { salesAnalysisAPI } from '../../services/api'
import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'
import AIInsightsCard from '../reports/AIInsightsCard'

const STORE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const fmt = (v) =>
  `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtFull = (v) =>
  `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtNum = (v) =>
  parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const fmtShort = (v) => {
  const n = parseFloat(v || 0)
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

const fmtDate = (d) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

export default function CompareView({ startDate, endDate, stores }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [selectedStores, setSelectedStores] = useState([])

  // Initialize with all stores selected
  useEffect(() => {
    if (stores.length > 0 && selectedStores.length === 0) {
      setSelectedStores(stores.map(s => s.id))
    }
  }, [stores])

  useEffect(() => {
    if (selectedStores.length > 0) fetchComparison()
  }, [startDate, endDate, selectedStores])

  const fetchComparison = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await salesAnalysisAPI.getComparison({
        start_date: startDate,
        end_date: endDate,
        store_ids: selectedStores.join(','),
      })
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load comparison.')
    } finally {
      setLoading(false)
    }
  }

  const toggleStore = (id) => {
    setSelectedStores(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
  }

  if (!data || !data.stores || data.stores.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-400 text-sm">Select stores to compare.</p>
      </Card>
    )
  }

  const { stores: storeData, daily_comparison } = data
  const storeColorMap = {}
  storeData.forEach((s, i) => {
    storeColorMap[s.organization.id] = STORE_COLORS[i % STORE_COLORS.length]
  })

  // Prepare daily chart data
  const chartData = (daily_comparison || []).map(d => {
    const entry = { date: fmtDate(d.date), fullDate: d.date }
    storeData.forEach(s => {
      entry[s.organization.name] = d[`store_${s.organization.id}`] || 0
    })
    return entry
  })

  // Day-of-week comparison
  const dowData = computeDayOfWeekComparison(daily_comparison, storeData)

  // Card vs Cash per store
  const paymentData = storeData.map(s => ({
    name: s.organization.name,
    card: s.total_card,
    cash: s.total_cash,
    other: s.total_other,
  }))

  // Radar data for normalized comparison
  const bestSales = Math.max(...storeData.map(s => s.total_sales), 1)
  const bestAvg = Math.max(...storeData.map(s => s.avg_daily), 1)
  const bestSplh = Math.max(...storeData.map(s => s.splh || 0), 1)

  const radarData = [
    { metric: 'Total Sales', ...Object.fromEntries(storeData.map(s => [s.organization.name, Math.round((s.total_sales / bestSales) * 100)])) },
    { metric: 'Avg Daily', ...Object.fromEntries(storeData.map(s => [s.organization.name, Math.round((s.avg_daily / bestAvg) * 100)])) },
    { metric: 'SPLH', ...Object.fromEntries(storeData.map(s => [s.organization.name, Math.round(((s.splh || 0) / bestSplh) * 100)])) },
    { metric: 'Card %', ...Object.fromEntries(storeData.map(s => [s.organization.name, s.total_sales > 0 ? Math.round((s.total_card / s.total_sales) * 100) : 0])) },
    { metric: 'Days Active', ...Object.fromEntries(storeData.map(s => [s.organization.name, Math.round((s.days_with_data / Math.max(...storeData.map(x => x.days_with_data), 1)) * 100)])) },
  ]

  return (
    <div className="space-y-6">
      {/* Store selector chips */}
      <Card className="p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select Stores to Compare</p>
        <div className="flex flex-wrap gap-2">
          {stores.map((s, i) => {
            const isSelected = selectedStores.includes(s.id)
            const color = STORE_COLORS[i % STORE_COLORS.length]
            return (
              <button
                key={s.id}
                onClick={() => toggleStore(s.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition border-2 ${
                  isSelected
                    ? 'text-white shadow-sm'
                    : 'bg-white text-gray-400 border-gray-200'
                }`}
                style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
              >
                {s.name}
              </button>
            )
          })}
        </div>
      </Card>

      {/* KPI Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {storeData.map((s, i) => (
          <Card key={s.organization.id} className="p-4 border-t-4" style={{ borderTopColor: storeColorMap[s.organization.id] }}>
            <h3 className="text-sm font-bold text-gray-900 mb-3">{s.organization.name}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Total Sales</p>
                <p className="text-lg font-bold text-gray-900">{fmtFull(s.total_sales)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Avg Daily</p>
                <p className="text-lg font-bold text-gray-900">{fmtFull(s.avg_daily)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">vs Prev</p>
                <p className={`text-sm font-bold ${(s.change_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {(s.change_pct || 0) >= 0 ? '↑' : '↓'} {Math.abs(s.change_pct || 0).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Days</p>
                <p className="text-sm font-bold text-gray-700">{s.days_with_data}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">SPLH</p>
                <p className="text-sm font-bold text-gray-700">{fmtFull(s.splh)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Labor %</p>
                <p className={`text-sm font-bold ${(s.labor_pct || 0) > 35 ? 'text-red-600' : (s.labor_pct || 0) > 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {(s.labor_pct || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Daily Sales Trend - All Stores Overlay */}
      {chartData.length > 0 && (
        <>
          <SectionLabel>Daily Sales Trend — All Stores</SectionLabel>
          <Card className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={fmtShort} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  formatter={(value, name) => [fmt(value), name]}
                />
                <Legend />
                {storeData.map((s, i) => (
                  <Line
                    key={s.organization.id}
                    type="monotone"
                    dataKey={s.organization.name}
                    stroke={storeColorMap[s.organization.id]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: storeColorMap[s.organization.id] }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* Two column: Radar + Sales Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Radar Chart - Normalized Performance */}
        <div>
          <SectionLabel>Performance Radar</SectionLabel>
          <Card className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <PolarRadiusAxis tick={false} domain={[0, 100]} />
                {storeData.map((s, i) => (
                  <Radar
                    key={s.organization.id}
                    name={s.organization.name}
                    dataKey={s.organization.name}
                    stroke={storeColorMap[s.organization.id]}
                    fill={storeColorMap[s.organization.id]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Total Sales Bar */}
        <div>
          <SectionLabel>Total Sales Comparison</SectionLabel>
          <Card className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={storeData.map(s => ({ name: s.organization.name, sales: s.total_sales, id: s.organization.id }))} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={fmtShort} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(value) => [fmt(value), 'Total Sales']}
                />
                <Bar dataKey="sales" radius={[8, 8, 0, 0]} barSize={50}>
                  {storeData.map((s, i) => (
                    <Cell key={s.organization.id} fill={storeColorMap[s.organization.id]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Day of Week Comparison */}
      {dowData.length > 0 && (
        <>
          <SectionLabel>Day of Week — Store Comparison</SectionLabel>
          <Card className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dowData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={fmtShort} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(value, name) => [fmt(value), name]}
                />
                <Legend />
                {storeData.map((s, i) => (
                  <Bar
                    key={s.organization.id}
                    dataKey={s.organization.name}
                    fill={storeColorMap[s.organization.id]}
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* Payment Method Comparison */}
      <SectionLabel>Payment Method Breakdown</SectionLabel>
      <Card className="p-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={paymentData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} tickFormatter={fmtShort} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }} width={120} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              formatter={(value) => [fmt(value)]}
            />
            <Legend />
            <Bar dataKey="card" name="Card" fill="#1e293b" radius={[0, 4, 4, 0]} stackId="a" />
            <Bar dataKey="cash" name="Cash" fill="#10b981" radius={[0, 4, 4, 0]} stackId="a" />
            {paymentData.some(d => d.other > 0) && (
              <Bar dataKey="other" name="Other" fill="#60a5fa" radius={[0, 4, 4, 0]} stackId="a" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Ranking Table */}
      <SectionLabel>Store Ranking</SectionLabel>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-3 font-semibold text-gray-600">#</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Store</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Total Sales</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Avg/Day</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">vs Prev</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Card</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Cash</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">SPLH</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600">Labor%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {storeData.map((s, i) => (
                <tr key={s.organization.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-3 py-2.5">
                    <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: storeColorMap[s.organization.id] }}>
                      {s.rank}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-900">{s.organization.name}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmtFull(s.total_sales)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{fmtFull(s.avg_daily)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${(s.change_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(s.change_pct || 0) >= 0 ? '↑' : '↓'} {Math.abs(s.change_pct || 0).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{fmtFull(s.total_card)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{fmtFull(s.total_cash)}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-700">{fmtFull(s.splh)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${(s.labor_pct || 0) > 35 ? 'text-red-600' : (s.labor_pct || 0) > 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {(s.labor_pct || 0).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI Insights */}
      <AIInsightsCard
        startDate={startDate}
        endDate={endDate}
        storeId={null}
        useSalesAnalysisAPI
      />
    </div>
  )
}

function computeDayOfWeekComparison(dailyComparison, storeData) {
  if (!dailyComparison || !storeData) return []
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const map = {}
  dayOrder.forEach(d => { map[d] = {} })

  for (const row of dailyComparison) {
    if (!row.date) continue
    const dt = new Date(row.date + 'T00:00:00')
    const dayName = dayNames[dt.getDay()]
    if (!map[dayName]) continue

    for (const s of storeData) {
      const key = `store_${s.organization.id}`
      const name = s.organization.name
      if (!map[dayName][name]) map[dayName][name] = []
      map[dayName][name].push(row[key] || 0)
    }
  }

  return dayOrder.map(day => {
    const entry = { day }
    for (const s of storeData) {
      const arr = map[day][s.organization.name] || []
      entry[s.organization.name] = arr.length > 0
        ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
        : 0
    }
    return entry
  })
}

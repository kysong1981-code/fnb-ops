import { useState, useEffect } from 'react'
import { reportsAPI } from '../../services/api'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'

/* ── formatting helpers ── */
const fmt = (v) => (v != null && v !== 0 ? `$${Number(v).toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—')
const fmtNum = (v, d = 1) => (v != null ? Number(v).toLocaleString('en-NZ', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—')
const fmtPct = (v) => (v != null ? `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}%` : '—')
const fmtDate = (d) => {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  catch { return d }
}

/* ── category badge config ── */
const CAT = {
  NZ_PUBLIC:    { label: 'Public Holiday',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  NZ_SCHOOL:   { label: 'School Holiday',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  CN_MAJOR:    { label: 'Chinese Holiday',  color: 'bg-red-100 text-red-700 border-red-200' },
  CN_FESTIVAL: { label: 'Chinese Festival', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  OTHER:       { label: 'Other',            color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

const IMPACT_COLORS = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-green-100 text-green-700',
}

export default function HolidayReport() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData()
  }, [year])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await reportsAPI.getHolidayReport(year)
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load holiday report.')
    } finally {
      setLoading(false)
    }
  }

  const availableYears = [...new Set(data?.available_years || [currentYear - 2, currentYear - 1, currentYear, currentYear + 1])].sort((a, b) => a - b)
  const summary = data?.summary || {}
  const holidays = data?.holidays || []

  return (
    <div className="space-y-6">
      {/* ── Year selector ── */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-500">Year:</span>
          <div className="bg-gray-100 rounded-lg p-0.5 flex gap-0.5">
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                  year === y
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Summary KPI cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Holiday Sales" value={fmt(summary.total_holiday_sales)} sub={`${summary.total_holiday_days || 0} days`} color="blue" />
            <KPICard label="Avg Holiday Daily" value={fmt(summary.avg_holiday_daily)} sub={`Normal: ${fmt(summary.avg_normal_daily)}`} color="gray" />
            <KPICard label="Overall Impact" value={fmtPct(summary.overall_impact_pct)} sub="vs normal days" color={summary.overall_impact_pct >= 0 ? 'green' : 'red'} />
            <KPICard label="Holiday SPLH" value={fmt(summary.avg_holiday_splh)} sub={`${fmtNum(summary.total_holiday_hours, 0)}h total`} color="purple" />
          </div>

          {/* ── Holiday cards ── */}
          {holidays.length > 0 && (
            <>
              <SectionLabel>Holiday Breakdown</SectionLabel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {holidays.map((h, i) => (
                  <HolidayCard key={i} holiday={h} />
                ))}
              </div>
            </>
          )}

          {holidays.length === 0 && (
            <Card className="p-8 text-center text-gray-400 text-sm">
              No holiday data available for {year}.
            </Card>
          )}

          {/* ── Summary table ── */}
          {holidays.length > 0 && (
            <>
              <SectionLabel>Summary Table</SectionLabel>
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Holiday</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Period</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Sales</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Daily</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Impact</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Staff/Day</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Hours</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">SPLH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((h, i) => {
                      const s = h.sales || {}
                      const st = h.staffing || {}
                      const duration = getDuration(h.start_date, h.end_date)
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{h.name}</p>
                            {h.name_ko && <p className="text-[10px] text-gray-400">{h.name_ko}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {fmtDate(h.start_date)} — {fmtDate(h.end_date)}
                            <span className="ml-1 text-gray-400">({duration}d)</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(s.total)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt(s.avg_daily)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs font-semibold ${s.impact_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {s.impact_pct >= 0 ? '↑' : '↓'} {fmtPct(s.impact_pct)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmtNum(st.avg_staff_per_day, 1)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmtNum(st.total_hours, 0)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(st.splh)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}

function getDuration(start, end) {
  try {
    const s = new Date(start + 'T00:00:00')
    const e = new Date(end + 'T00:00:00')
    return Math.round((e - s) / 86400000) + 1
  } catch { return 1 }
}

/* ── KPI Card ── */
function KPICard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100',
    gray: 'bg-gray-50 border-gray-100',
    green: 'bg-green-50 border-green-100',
    red: 'bg-red-50 border-red-100',
    purple: 'bg-purple-50 border-purple-100',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ── Holiday Card ── */
function HolidayCard({ holiday: h }) {
  const cat = CAT[h.category] || CAT.OTHER
  const impactColor = IMPACT_COLORS[h.impact] || ''
  const s = h.sales || {}
  const st = h.staffing || {}
  const duration = getDuration(h.start_date, h.end_date)

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-base font-bold text-gray-900">
            {h.name}
            {h.name_ko && <span className="ml-2 text-sm font-normal text-gray-400">{h.name_ko}</span>}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtDate(h.start_date)} — {fmtDate(h.end_date)}
            <span className="ml-1.5 text-gray-400">({duration} days)</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.color}`}>
            {cat.label}
          </span>
          {h.impact && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${impactColor}`}>
              {h.impact}
            </span>
          )}
        </div>
      </div>

      {/* Sales + Staffing side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sales section */}
        <div className="bg-blue-50 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest">Sales</p>
          <div>
            <p className="text-lg font-bold text-gray-900">{fmt(s.total)}</p>
            <p className="text-xs text-gray-500">{s.days_with_data || 0} days data</p>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Avg Daily</span>
            <span className="font-semibold text-gray-700">{fmt(s.avg_daily)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Impact</span>
            <span className={`font-semibold ${s.impact_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {s.impact_pct >= 0 ? '↑' : '↓'} {Math.abs(s.impact_pct || 0).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Staffing section */}
        <div className="bg-purple-50 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-widest">Staffing</p>
          <div>
            <p className="text-lg font-bold text-gray-900">{fmtNum(st.avg_staff_per_day, 1)}</p>
            <p className="text-xs text-gray-500">Avg Staff/Day</p>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Total Hours</span>
            <span className="font-semibold text-gray-700">{fmtNum(st.total_hours, 0)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">SPLH</span>
            <span className="font-semibold text-gray-700">{fmt(st.splh)}</span>
          </div>
        </div>
      </div>

      {/* Comparison vs Normal */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between text-xs text-gray-500">
        <span>vs Normal Period</span>
        <div className="flex gap-4">
          <span>Avg Daily: <strong className="text-gray-700">{fmt(s.normal_avg)}</strong></span>
          <span>SPLH: <strong className="text-gray-700">{fmt(st.normal_splh)}</strong></span>
          <span>Staff: <strong className="text-gray-700">{fmtNum(st.normal_staff_avg, 1)}/day</strong></span>
        </div>
      </div>
    </Card>
  )
}

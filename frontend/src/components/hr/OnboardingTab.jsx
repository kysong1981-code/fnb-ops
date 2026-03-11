import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hrAPI } from '../../services/api'
import Card from '../ui/Card'

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ON_HOLD', label: 'On Hold' },
]

export default function OnboardingTab() {
  const navigate = useNavigate()
  const [onboardings, setOnboardings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('IN_PROGRESS')

  const loadOnboardings = async () => {
    setLoading(true)
    try {
      const params = filter ? { status: filter } : {}
      const res = await hrAPI.getOnboardings(params)
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setOnboardings(data)
    } catch { setOnboardings([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadOnboardings() }, [filter])

  const getProgressColor = (pct) => {
    if (pct >= 100) return 'bg-green-500'
    if (pct >= 75) return 'bg-blue-500'
    if (pct >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filter === f.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : onboardings.length === 0 ? (
        <Card className="p-8 text-center text-gray-400 text-sm">No onboardings found</Card>
      ) : (
        <Card>
          <div className="divide-y divide-gray-50">
            {onboardings.map((ob) => (
              <button
                key={ob.id}
                onClick={() => navigate(`/hr/onboarding/${ob.id}`)}
                className="w-full px-5 py-3.5 flex items-center gap-4 text-left hover:bg-gray-50 transition"
              >
                {/* Progress Circle */}
                <div className="relative w-10 h-10 flex-shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="16" fill="none"
                      stroke={ob.completed_percentage >= 100 ? '#22c55e' : ob.completed_percentage >= 50 ? '#3b82f6' : '#ef4444'}
                      strokeWidth="3" strokeDasharray={`${ob.completed_percentage} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900">
                    {ob.completed_percentage}%
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{ob.employee_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{ob.employee_id}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">
                      {ob.completed_tasks}/{ob.task_count} tasks
                    </span>
                  </div>
                </div>

                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  ob.status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                  ob.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {ob.status.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

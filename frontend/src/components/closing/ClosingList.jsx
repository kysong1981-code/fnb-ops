import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { closingAPI } from '../../services/api'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import { PlusIcon, ArrowRightIcon } from '../icons'

const MANAGER_ROLES = ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']

export default function ClosingList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [closings, setClosings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('ALL')

  const isManager = user && MANAGER_ROLES.includes(user.role)

  useEffect(() => {
    fetchClosings()
  }, [filter])

  const fetchClosings = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filter !== 'ALL') params.status = filter
      const res = await closingAPI.list(params)
      setClosings(res.data.results || res.data || [])
    } catch (err) {
      setError('Failed to load closings')
      setClosings([])
    } finally {
      setLoading(false)
    }
  }

  const statusBadge = {
    DRAFT: 'warning',
    SUBMITTED: 'info',
    APPROVED: 'success',
    REJECTED: 'neutral',
  }

  const statusLabel = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  }

  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const filters = ['ALL', 'SUBMITTED', 'APPROVED']

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Daily Closing</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isManager ? 'Review and approve closings' : 'Your closing records'}
          </p>
        </div>
        <button
          onClick={() => navigate('/closing/form')}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
        >
          <PlusIcon size={16} />
          New
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f === 'ALL' ? 'All' : statusLabel[f]}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : closings.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-400 text-sm">No closing records found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {closings.map((c) => {
            const variance = parseFloat(c.total_variance || 0)
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/closing/form?date=${c.closing_date}`)}
                className="w-full text-left"
              >
                <Card className="p-4 hover:border-gray-200 transition">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(c.closing_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <Badge variant={statusBadge[c.status]}>{statusLabel[c.status]}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-xs text-gray-400">POS {fmt(c.pos_total)}</span>
                        <span className="text-xs text-gray-400">Actual {fmt(c.actual_total)}</span>
                        {c.created_by_name && (
                          <span className="text-xs text-gray-300">{c.created_by_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <span className={`text-sm font-semibold ${
                        variance === 0 ? 'text-green-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {variance >= 0 ? '+' : ''}{fmt(variance)}
                      </span>
                      <ArrowRightIcon size={14} className="text-gray-300" />
                    </div>
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

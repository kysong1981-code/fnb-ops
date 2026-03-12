import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { safetyAPI } from '../../services/api'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'
import { ShieldIcon, CheckCircleIcon, ClockIcon } from '../icons'
import SafetyRecordForm from './records/SafetyRecordForm'

// Tasks that navigate to a dedicated page instead of quick complete
const LEGACY_ROUTES = {
  daily_temperature: '/safety/temperatures/new',
  daily_cleaning: '/safety/cleaning',
}

export default function SafetyTasksWidget() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const fetchTasks = async () => {
    try {
      const res = await safetyAPI.getTodayTasks()
      setTasks(res.data)
    } catch (err) {
      console.error('Failed to fetch today tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const handleComplete = (task) => {
    setSelectedTask(task)
    setShowForm(true)
  }

  const handleFormSubmit = async (formData) => {
    try {
      await safetyAPI.quickComplete({
        record_type: selectedTask.record_type.code,
        data: formData,
        notes: formData._notes || '',
      })
      setShowForm(false)
      setSelectedTask(null)
      fetchTasks()
    } catch (err) {
      console.error('Failed to complete record:', err)
    }
  }

  const handleQuickComplete = async (task) => {
    try {
      await safetyAPI.quickComplete({
        record_type: task.record_type.code,
        data: {},
        notes: '',
      })
      fetchTasks()
    } catch (err) {
      console.error('Failed to quick complete:', err)
    }
  }

  const completedCount = tasks.filter(t => t.is_completed).length
  const totalCount = tasks.length

  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ShieldIcon size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Today's Safety Tasks</p>
            <p className="text-xs text-gray-400">Loading...</p>
          </div>
        </div>
      </Card>
    )
  }

  if (totalCount === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <ShieldIcon size={20} className="text-gray-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Safety Tasks</p>
            <p className="text-xs text-gray-400">No tasks configured yet</p>
          </div>
        </div>
      </Card>
    )
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    const h = parseInt(parts[0])
    const m = parts[1]
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${m} ${ampm}`
  }

  return (
    <>
      <Card className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              completedCount === totalCount ? 'bg-emerald-100' : 'bg-amber-50'
            }`}>
              <ShieldIcon size={20} className={
                completedCount === totalCount ? 'text-emerald-600' : 'text-amber-600'
              } />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Today's Safety Tasks</p>
              <p className="text-xs text-gray-400">
                {completedCount}/{totalCount} completed
              </p>
            </div>
          </div>
          {/* Progress ring */}
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#E5E7EB" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="14" fill="none"
                stroke={completedCount === totalCount ? '#10B981' : '#F59E0B'}
                strokeWidth="3"
                strokeDasharray={`${(completedCount / totalCount) * 88} 88`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
              {Math.round((completedCount / totalCount) * 100)}%
            </span>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {tasks.map((task, idx) => {
            const rt = task.record_type
            const hasFields = rt.default_fields && rt.default_fields.length > 0

            return (
              <div
                key={rt.code}
                className={`rounded-xl p-3 ${
                  task.is_completed
                    ? 'bg-emerald-50/50 border border-emerald-100'
                    : 'bg-gray-50 border border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Status indicator */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      task.is_completed ? 'bg-emerald-100' : 'bg-white border border-gray-200'
                    }`}>
                      {task.is_completed ? (
                        <CheckCircleIcon size={16} className="text-emerald-600" />
                      ) : (
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: rt.color_code || '#3B82F6' }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${
                        task.is_completed ? 'text-emerald-700' : 'text-gray-900'
                      }`}>
                        {rt.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {rt.name_ko}
                        {task.is_completed && task.record && (
                          <span className="ml-2">
                            {formatTime(task.record.time)} · {task.record.completed_by_name}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Action */}
                  {!task.is_completed && (
                    <button
                      onClick={() => {
                        const route = LEGACY_ROUTES[rt.code]
                        if (route) {
                          navigate(route)
                        } else if (hasFields) {
                          handleComplete(task)
                        } else {
                          handleQuickComplete(task)
                        }
                      }}
                      className="ml-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0 active:scale-95"
                    >
                      {LEGACY_ROUTES[rt.code] ? 'Open' : '✓ Complete'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Form Modal */}
      {showForm && selectedTask && (
        <SafetyRecordForm
          recordType={selectedTask.record_type}
          onSubmit={handleFormSubmit}
          onClose={() => { setShowForm(false); setSelectedTask(null) }}
        />
      )}
    </>
  )
}

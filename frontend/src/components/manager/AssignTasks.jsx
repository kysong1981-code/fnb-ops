import { useState, useEffect, useCallback } from 'react'
import { hrAPI } from '../../services/api'
import { getTodayNZ } from '../../utils/date'
import Card from '../ui/Card'
import PageHeader from '../ui/PageHeader'
import Badge from '../ui/Badge'
import KpiCard from '../ui/KpiCard'
import { ClipboardIcon } from '../icons'

export default function AssignTasks() {
  const [tasks, setTasks] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    assigned_to: '',
    priority: 'MEDIUM',
    due_date: getTodayNZ(),
    due_time: '',
    description: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [tasksRes, teamRes] = await Promise.all([
        hrAPI.getTasks(),
        hrAPI.getTeam(),
      ])
      setTasks(tasksRes.data.results || tasksRes.data || [])
      setTeam(teamRes.data || [])
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddTask = async () => {
    if (!newTask.title || !newTask.assigned_to) return
    setSaving(true)
    try {
      await hrAPI.createTask({
        title: newTask.title,
        description: newTask.description,
        assigned_to: parseInt(newTask.assigned_to),
        priority: newTask.priority,
        due_date: newTask.due_date,
        due_time: newTask.due_time || null,
      })
      setNewTask({
        title: '',
        assigned_to: '',
        priority: 'MEDIUM',
        due_date: getTodayNZ(),
        due_time: '',
        description: '',
      })
      setShowForm(false)
      await fetchData()
    } catch (err) {
      const detail = err.response?.data
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : 'Failed to add task'
      setError(msg)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async (id) => {
    try {
      await hrAPI.startTask(id)
      await fetchData()
    } catch (err) {
      setError('Failed to update status')
      console.error(err)
    }
  }

  const handleComplete = async (id) => {
    try {
      await hrAPI.completeTask(id)
      await fetchData()
    } catch (err) {
      setError('Failed to complete task')
      console.error(err)
    }
  }

  const priorityVariant = {
    HIGH: 'danger',
    MEDIUM: 'warning',
    LOW: 'success',
  }
  const priorityLabels = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }

  const statusVariant = {
    PENDING: 'neutral',
    IN_PROGRESS: 'info',
    COMPLETED: 'success',
  }
  const statusLabels = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' }

  const pendingCount = tasks.filter((t) => t.status === 'PENDING').length
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length

  return (
    <div className="px-4 py-6 space-y-6">
      <PageHeader
        icon={ClipboardIcon}
        title="Assign Tasks"
        subtitle="Assign tasks to team members and track progress"
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-5 rounded-2xl transition text-sm"
          >
            {showForm ? 'Cancel' : '+ New Task'}
          </button>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="text-red-500 text-xs mt-1 underline">Close</button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Pending" value={pendingCount} />
        <KpiCard label="In Progress" value={inProgressCount} />
        <KpiCard label="Completed" value={completedCount} />
      </div>

      {/* New Task Form */}
      {showForm && (
        <Card className="p-6 space-y-4">
          <h3 className="font-bold text-gray-900">New Task</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter task description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
              <select
                value={newTask.assigned_to}
                onChange={(e) => setNewTask((prev) => ({ ...prev, assigned_to: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select employee</option>
                {team.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask((prev) => ({ ...prev, due_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Time (optional)</label>
              <input
                type="time"
                value={newTask.due_time}
                onChange={(e) => setNewTask((prev) => ({ ...prev, due_time: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={newTask.description}
                onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Additional details"
              />
            </div>
          </div>
          <button
            onClick={handleAddTask}
            disabled={saving || !newTask.title || !newTask.assigned_to}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-2xl transition disabled:bg-gray-300"
          >
            {saving ? 'Adding...' : 'Assign Task'}
          </button>
        </Card>
      )}

      {/* Task List */}
      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">Loading...</p>
        </Card>
      ) : tasks.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">No tasks assigned</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-medium ${task.status === 'COMPLETED' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {task.title}
                  </h3>
                  <Badge variant={priorityVariant[task.priority]}>
                    {priorityLabels[task.priority]}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Assigned: <strong>{task.assigned_to_name}</strong></span>
                  <span>Due: {task.due_date}{task.due_time ? ` ${task.due_time}` : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[task.status]}>
                  {statusLabels[task.status]}
                </Badge>
                {task.status === 'PENDING' && (
                  <button
                    onClick={() => handleStart(task.id)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl transition"
                  >
                    Start
                  </button>
                )}
                {task.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => handleComplete(task.id)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition"
                  >
                    Complete
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { getTodayNZ, formatDateNZ } from '../../../utils/date'

export default function CleaningSchedule() {
  const navigate = useNavigate()
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedWeek, setSelectedWeek] = useState(new Date())

  useEffect(() => {
    fetchSchedule()
  }, [selectedWeek])

  const fetchSchedule = async () => {
    setLoading(true)
    setError('')
    try {
      const startOfWeek = getStartOfWeek(selectedWeek)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 6)

      const response = await api.get('/safety/cleaning/schedule/', {
        params: {
          date_from: startOfWeek.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }),
          date_to: endOfWeek.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
        }
      })
      setSchedule(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load cleaning schedule.')
    } finally {
      setLoading(false)
    }
  }

  const getStartOfWeek = (date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }

  const getDaysOfWeek = () => {
    const start = getStartOfWeek(selectedWeek)
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      days.push(date)
    }
    return days
  }

  const getScheduleForDate = (date) => {
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
    return schedule.filter(s => s.date === dateStr)
  }

  const getDayName = (date) => {
    return date.toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getPrevWeek = () => {
    const prev = new Date(selectedWeek)
    prev.setDate(prev.getDate() - 7)
    setSelectedWeek(prev)
  }

  const getNextWeek = () => {
    const next = new Date(selectedWeek)
    next.setDate(next.getDate() + 7)
    setSelectedWeek(next)
  }

  const getTodayWeek = () => {
    setSelectedWeek(new Date())
  }

  if (loading && schedule.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">Loading cleaning schedule...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Weekly Cleaning Schedule</h1>
          <p className="text-gray-600 mt-1">View weekly cleaning plan and completion status.</p>
        </div>
        <button
          onClick={() => navigate('/safety/cleaning')}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          + Add Cleaning Record
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={getPrevWeek}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            &larr; Previous Week
          </button>

          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">
              {getStartOfWeek(selectedWeek).toLocaleDateString('en-NZ', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              {' ~ '}
              {(() => {
                const end = new Date(getStartOfWeek(selectedWeek))
                end.setDate(end.getDate() + 6)
                return end.toLocaleDateString('en-NZ', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              })()}
            </p>
          </div>

          <div className="space-x-2">
            <button
              onClick={getTodayWeek}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Today
            </button>
            <button
              onClick={getNextWeek}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Next Week &rarr;
            </button>
          </div>
        </div>

        {/* Weekly Grid */}
        <div className="grid grid-cols-7 gap-2">
          {getDaysOfWeek().map(date => {
            const daySchedule = getScheduleForDate(date)
            const isToday = date.toDateString() === new Date().toDateString()
            const isPast = date < new Date() && !isToday

            return (
              <div
                key={date.toISOString()}
                className={`rounded-lg border-2 p-4 min-h-32 ${
                  isToday
                    ? 'bg-blue-50 border-blue-500'
                    : isPast
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="mb-2">
                  <p className="font-semibold text-gray-900">{getDayName(date)}</p>
                  {isToday && <span className="inline-block px-2 py-1 bg-blue-600 text-white text-xs rounded mt-1">Today</span>}
                  {isPast && <span className="inline-block px-2 py-1 bg-gray-400 text-white text-xs rounded mt-1">Past</span>}
                </div>

                {/* Schedule Items for Date */}
                <div className="space-y-1">
                  {daySchedule.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No plans</p>
                  ) : (
                    daySchedule.map(item => (
                      <div
                        key={item.id}
                        className={`text-xs p-1 rounded ${
                          item.is_completed
                            ? 'bg-green-100 text-green-700 line-through'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        <p className="font-medium">{item.area}</p>
                        {item.is_completed && <p className="text-xs">&#10003; Done</p>}
                      </div>
                    ))
                  )}
                </div>

                {/* Record Button (today or future) */}
                {!isPast && daySchedule.length > 0 && (
                  <button
                    onClick={() => navigate(`/safety/cleaning?date=${date.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })}`)}
                    className="mt-2 w-full px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Record
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Loading State */}
      {loading && schedule.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
        </div>
      )}

      {/* No Schedule */}
      {!loading && schedule.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No cleaning schedule for this week.</p>
          <button
            onClick={() => navigate('/safety/cleaning')}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Add Cleaning Record
          </button>
        </div>
      )}
    </div>
  )
}

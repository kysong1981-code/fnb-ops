import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { safetyAPI } from '../../../services/api'

const AREA_BADGE_COLORS = [
  'bg-red-100 text-red-800',
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-cyan-100 text-cyan-800',
  'bg-orange-100 text-orange-800',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-slate-100 text-slate-800',
  'bg-pink-100 text-pink-800',
  'bg-teal-100 text-teal-800',
]

export default function CleaningHistory() {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    area: ''
  })
  const [allAreas, setAllAreas] = useState([])
  const [areaBadgeMap, setAreaBadgeMap] = useState({})

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await safetyAPI.getCleaningAreas()
        const areas = (Array.isArray(res.data) ? res.data : res.data.results || [])
          .filter(a => a.is_active)
        setAllAreas(areas)
        const map = {}
        areas.forEach((a, i) => {
          map[a.name] = AREA_BADGE_COLORS[i % AREA_BADGE_COLORS.length]
        })
        setAreaBadgeMap(map)
      } catch (e) {
        console.error('Failed to load cleaning areas', e)
      }
    }
    fetchAreas()
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [filters])

  const fetchRecords = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filters.dateFrom) params.date_from = filters.dateFrom
      if (filters.dateTo) params.date_to = filters.dateTo
      if (filters.area) params.area = filters.area

      const response = await api.get('/safety/cleaning/', { params })
      setRecords(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load cleaning records.')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleClearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      area: ''
    })
  }

  const getAreaBadgeColor = (area) => {
    return areaBadgeMap[area] || 'bg-gray-100 text-gray-800'
  }

  if (loading && records.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        <p className="text-gray-600 mt-4">Loading cleaning records...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cleaning History</h1>
          <p className="text-gray-600 mt-1">View and manage past cleaning records.</p>
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cleaning Area</label>
            <select
              name="area"
              value={filters.area}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All</option>
              {allAreas.map(area => (
                <option key={area.id} value={area.name}>{area.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleClearFilters}
          className="mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>

      {/* Cleaning Records List */}
      <div className="bg-white rounded-lg shadow-sm divide-y">
        {records.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No cleaning records found.</p>
          </div>
        ) : (
          records.map(record => (
            <div key={record.id} className="p-6 hover:bg-gray-50 transition">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {/* Basic Info */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">Cleaning Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(record.date).toLocaleDateString('en-NZ')}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Recorded by: {record.cleaned_by_name || 'Unassigned'}
                  </p>
                </div>

                {/* Cleaning Areas */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">Cleaning Areas</p>
                  <div className="flex flex-wrap gap-1">
                    {record.area && record.area.split(', ').map(area => (
                      <span key={area} className={`inline-block px-2 py-1 rounded text-xs font-medium ${getAreaBadgeColor(area)}`}>
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  {record.is_completed ? (
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                      &#10003; Completed
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                      In Progress
                    </span>
                  )}
                  {record.attachment && (
                    <p className="text-xs text-blue-600 mt-2">
                      &#128206; {record.attachment.split('/').pop()}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {record.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded border-l-4 border-green-500">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Notes:</span> {record.notes}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Loading State */}
      {loading && records.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
        </div>
      )}
    </div>
  )
}

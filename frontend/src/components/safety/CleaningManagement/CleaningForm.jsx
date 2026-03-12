import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { safetyAPI } from '../../../services/api'

export default function CleaningForm() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    areas: [],
    notes: '',
    date: new Date().toISOString().split('T')[0]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cleaningAreas, setCleaningAreas] = useState([])

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await safetyAPI.getCleaningAreas()
        const areas = (Array.isArray(res.data) ? res.data : res.data.results || [])
          .filter(a => a.is_active)
        setCleaningAreas(areas)
      } catch (e) {
        console.error('Failed to load cleaning areas', e)
      }
    }
    fetchAreas()
  }, [])

  const handleAreaToggle = (areaName) => {
    setFormData(prev => ({
      ...prev,
      areas: prev.areas.includes(areaName)
        ? prev.areas.filter(a => a !== areaName)
        : [...prev.areas, areaName]
    }))
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = {
        date: formData.date,
        area: formData.areas.join(', '),
        notes: formData.notes,
        is_completed: true
      }

      await api.post('/safety/cleaning/', data)
      setSuccess('Cleaning record saved successfully.')

      setTimeout(() => {
        navigate('/safety/cleaning')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save record.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cleaning Record</h1>
        <p className="text-gray-600 mt-1">Record cleaning tasks completed today.</p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-4 rounded">
          {success}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Basic Info</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Cleaning Areas */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cleaning Areas</h3>
          <p className="text-sm text-gray-600 mb-4">Select all areas that were cleaned</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cleaningAreas.map(area => (
              <label
                key={area.id}
                className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition ${
                  formData.areas.includes(area.name)
                    ? 'bg-green-50 border-green-500'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.areas.includes(area.name)}
                  onChange={() => handleAreaToggle(area.name)}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                />
                <span className="ml-3 text-sm font-medium text-gray-900">{area.name}</span>
              </label>
            ))}
          </div>

          {formData.areas.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
              <p className="text-sm text-green-800">
                <span className="font-semibold">Selected areas:</span> {formData.areas.join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Info</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="4"
              placeholder="Enter cleaning supplies used, special notes, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate('/safety/cleaning')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || formData.areas.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

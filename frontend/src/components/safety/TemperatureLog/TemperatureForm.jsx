import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function TemperatureForm() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    location: '',
    temperature: '',
    time: new Date().toTimeString().slice(0, 5),
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [status, setStatus] = useState(null)

  const locations = [
    { value: '냉동실', label: '냉동실 (Freezer)', standard: -18 },
    { value: '냉장실', label: '냉장실 (Fridge)', standard: 4 },
    { value: '조리용', label: '조리용 (Cooking)', standard: 75 }
  ]

  const selectedLocation = locations.find(l => l.value === formData.location)
  const standard = selectedLocation?.standard || 0

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // 온도가 입력되면 상태 판별
    if (name === 'temperature') {
      const temp = parseFloat(value)
      const standardTemp = standard

      if (isNaN(temp)) {
        setStatus(null)
      } else {
        const diff = Math.abs(temp - standardTemp)
        if (diff <= 2) {
          setStatus({ type: 'normal', message: '정상 범위' })
        } else if (diff <= 4) {
          setStatus({ type: 'warning', message: '경고 범위' })
        } else {
          setStatus({ type: 'critical', message: '위험 범위' })
        }
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 시간을 전체 datetime으로 변환
      const today = new Date().toISOString().split('T')[0]
      const datetime = `${today}T${formData.time}:00Z`

      const data = {
        location: formData.location,
        temperature: parseFloat(formData.temperature),
        time: datetime,
        notes: formData.notes
      }

      await api.post('/safety/temperatures/', data)
      setSuccess('온도 기록이 저장되었습니다.')

      // 폼 초기화
      setFormData({
        location: '',
        temperature: '',
        time: new Date().toTimeString().slice(0, 5),
        notes: ''
      })
      setStatus(null)

      setTimeout(() => {
        navigate('/safety/temperatures')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = () => {
    if (!status) return 'text-gray-600'
    switch (status.type) {
      case 'normal':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'critical':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusBgColor = () => {
    if (!status) return 'bg-gray-50'
    switch (status.type) {
      case 'normal':
        return 'bg-green-50 border-green-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'critical':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">온도 기록</h1>
        <p className="text-gray-600 mt-1">냉장고, 냉동고, 조리 온도를 기록합니다.</p>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 성공 메시지 */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-4 rounded">
          {success}
        </div>
      )}

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">온도 정보</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 위치 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                위치 <span className="text-red-600">*</span>
              </label>
              <select
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">위치를 선택하세요</option>
                {locations.map(loc => (
                  <option key={loc.value} value={loc.value}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 시간 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시간 <span className="text-red-600">*</span>
              </label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 온도 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              온도 (°C) <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="temperature"
                value={formData.temperature}
                onChange={handleInputChange}
                step="0.1"
                required
                placeholder="온도를 입력하세요"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {selectedLocation && (
                <div className="px-4 py-2 bg-blue-50 rounded-lg border border-blue-200 text-sm font-medium text-blue-700 whitespace-nowrap">
                  표준: {selectedLocation.standard}°C
                </div>
              )}
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="3"
              placeholder="추가 사항이나 특이사항을 입력하세요."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 상태 표시 */}
        {status && (
          <div className={`p-6 rounded-lg border-2 ${getStatusBgColor()}`}>
            <div className="flex items-center gap-4">
              <div
                className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${
                  status.type === 'normal'
                    ? 'bg-green-100 text-green-600'
                    : status.type === 'warning'
                    ? 'bg-yellow-100 text-yellow-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {status.type === 'normal' && '✓'}
                {status.type === 'warning' && '!'}
                {status.type === 'critical' && '×'}
              </div>
              <div className="flex-1">
                <h4 className={`text-lg font-semibold ${getStatusColor()}`}>
                  {status.message}
                </h4>
                {formData.temperature && selectedLocation && (
                  <p className="text-sm text-gray-600 mt-1">
                    입력: {formData.temperature}°C | 표준: {selectedLocation.standard}°C |
                    편차: {Math.abs(formData.temperature - selectedLocation.standard).toFixed(1)}°C
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate('/safety/temperatures')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading || !formData.location || !formData.temperature}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

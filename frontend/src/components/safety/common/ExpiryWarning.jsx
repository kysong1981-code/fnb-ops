import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function ExpiryWarning() {
  const navigate = useNavigate()
  const [expiringItems, setExpiringItems] = useState({
    training: [],
    cleaning: [],
    other: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dismissedWarnings, setDismissedWarnings] = useState([])

  useEffect(() => {
    fetchExpiryData()
  }, [])

  const fetchExpiryData = async () => {
    setLoading(true)
    setError('')
    try {
      // 만료 예정 교육 조회
      const trainingRes = await api.get('/safety/training/upcoming_expiry/')
      const trainingData = Array.isArray(trainingRes.data) ? trainingRes.data : trainingRes.data.results || []

      // 냉장고/냉동고 비정상 온도 조회
      const tempRes = await api.get('/safety/temperatures/alerts/')
      const tempData = Array.isArray(tempRes.data) ? tempRes.data : tempRes.data.results || []

      setExpiringItems({
        training: trainingData.map(t => ({
          id: `training-${t.id}`,
          type: 'training',
          title: t.title,
          daysUntilExpiry: t.days_until_expiry,
          expiryDate: t.expiry_date,
          severity: t.days_until_expiry <= 7 ? 'critical' : 'warning'
        })),
        cleaning: [],
        other: tempData.slice(0, 3).map(t => ({
          id: `temp-${t.id}`,
          type: 'temperature',
          title: `${t.location} 온도 비정상`,
          currentTemp: t.current_temp,
          standardTemp: t.standard_temp,
          severity: t.severity
        }))
      })
    } catch (err) {
      console.error('만료 데이터 조회 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = (id) => {
    setDismissedWarnings(prev => [...prev, id])
  }

  const getWarningIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return '🚨'
      case 'warning':
        return '⚠️'
      default:
        return 'ℹ️'
    }
  }

  const getWarningColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-l-4 border-red-500'
      case 'warning':
        return 'bg-yellow-50 border-l-4 border-yellow-500'
      default:
        return 'bg-blue-50 border-l-4 border-blue-500'
    }
  }

  const totalWarnings = Object.values(expiringItems).reduce((sum, arr) => sum + arr.length, 0) - dismissedWarnings.length

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-2 text-sm">로드 중...</p>
      </div>
    )
  }

  if (totalWarnings === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-green-800 text-sm font-medium">✓ 주의 필요한 항목이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 만료 예정 교육 */}
      {expiringItems.training
        .filter(item => !dismissedWarnings.includes(item.id))
        .map(training => (
          <div key={training.id} className={`rounded-lg p-4 ${getWarningColor(training.severity)}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{getWarningIcon(training.severity)}</span>
                  <h4 className="font-semibold text-gray-900">교육 만료 예정</h4>
                </div>
                <p className="text-gray-700 text-sm mb-1">
                  <span className="font-medium">{training.title}</span>
                </p>
                <p className="text-gray-600 text-xs">
                  {training.daysUntilExpiry > 0
                    ? `${training.daysUntilExpiry}일 후 만료`
                    : '만료됨'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/safety/training')}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  보기
                </button>
                <button
                  onClick={() => handleDismiss(training.id)}
                  className="px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}

      {/* 온도 비정상 */}
      {expiringItems.other
        .filter(item => !dismissedWarnings.includes(item.id))
        .map(temp => (
          <div key={temp.id} className={`rounded-lg p-4 ${getWarningColor(temp.severity)}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{getWarningIcon(temp.severity)}</span>
                  <h4 className="font-semibold text-gray-900">온도 비정상</h4>
                </div>
                <p className="text-gray-700 text-sm mb-1">
                  <span className="font-medium">{temp.title}</span>
                </p>
                <p className="text-gray-600 text-xs">
                  현재: {temp.currentTemp}°C | 표준: {temp.standardTemp}°C
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/safety/temperatures')}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  보기
                </button>
                <button
                  onClick={() => handleDismiss(temp.id)}
                  className="px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
    </div>
  )
}

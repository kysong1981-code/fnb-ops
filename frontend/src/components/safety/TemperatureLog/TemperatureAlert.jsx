import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function TemperatureAlert() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchAlerts()
    // 30초마다 자동 갱신
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchAlerts = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/safety/temperatures/alerts/')
      setAlerts(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || '경고를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          icon: 'bg-yellow-100 text-yellow-600',
          text: 'text-yellow-700'
        }
      case 'critical':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: 'bg-red-100 text-red-600',
          text: 'text-red-700'
        }
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          icon: 'bg-gray-100 text-gray-600',
          text: 'text-gray-700'
        }
    }
  }

  const filteredAlerts = filter === 'all'
    ? alerts
    : alerts.filter(a => a.status === filter)

  const criticalCount = alerts.filter(a => a.status === 'critical').length
  const warningCount = alerts.filter(a => a.status === 'warning').length

  if (loading && alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">경고 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">온도 경고</h1>
        <p className="text-gray-600 mt-1">비정상 온도 기록을 실시간으로 모니터링합니다.</p>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 전체 경고 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">전체 경고</h3>
          <div className="text-3xl font-bold text-orange-600">{alerts.length}</div>
          <p className="text-sm text-gray-600 mt-2">비정상 온도 기록</p>
        </div>

        {/* 경고 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">경고</h3>
          <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
          <p className="text-sm text-gray-600 mt-2">±2~4°C 편차</p>
        </div>

        {/* 위험 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">위험</h3>
          <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
          <p className="text-sm text-gray-600 mt-2">±4°C 이상 편차</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            모든 경고 ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'warning'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            경고만 ({warningCount})
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'critical'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            위험만 ({criticalCount})
          </button>
        </div>
      </div>

      {/* 경고 목록 */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 text-lg">
              {filter === 'all'
                ? '경고가 없습니다. 모든 온도가 정상 범위입니다!'
                : '선택한 필터에 해당하는 경고가 없습니다.'}
            </p>
            <p className="text-green-600 font-semibold mt-2">✓ 시스템 정상</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const colors = getStatusColor(alert.status)
            const timeDiff = alert.temperature - (alert.standard_temperature || 0)
            const severity = Math.abs(timeDiff)

            return (
              <div
                key={alert.id}
                className={`bg-white rounded-lg shadow-md p-6 border-2 ${colors.bg}`}
              >
                <div className="flex items-start gap-4">
                  {/* 아이콘 */}
                  <div
                    className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      colors.icon
                    }`}
                  >
                    {alert.status === 'critical' ? '!' : '⚠'}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className={`text-lg font-semibold ${colors.text}`}>
                        {alert.location}
                      </h4>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.bg}`}
                      >
                        {alert.status === 'critical' ? '위험' : '경고'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">현재 온도</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {alert.temperature}°C
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">표준 온도</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {alert.standard_temperature}°C
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">편차</p>
                        <p
                          className={`text-lg font-semibold ${
                            alert.status === 'critical'
                              ? 'text-red-600'
                              : 'text-yellow-600'
                          }`}
                        >
                          {timeDiff > 0 ? '+' : ''}{timeDiff.toFixed(1)}°C
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">기록 시간</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {new Date(alert.created_at).toLocaleTimeString('ko-KR')}
                        </p>
                      </div>
                    </div>

                    {alert.notes && (
                      <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold">비고:</span> {alert.notes}
                        </p>
                      </div>
                    )}

                    {/* 위험도 바 */}
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-600">심각도</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              alert.status === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}
                            style={{
                              width: `${Math.min((severity / 8) * 100, 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-600">
                          {severity.toFixed(1)}°
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 액션 */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => navigate('/safety/temperatures')}
                      className="px-3 py-2 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
                    >
                      상세 보기
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 로딩 상태 */}
      {loading && alerts.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

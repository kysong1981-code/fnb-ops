import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function TemperatureList() {
  const navigate = useNavigate()
  const [temperatures, setTemperatures] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    location: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => {
    fetchTemperatures()
  }, [filters])

  const fetchTemperatures = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filters.location) params.location = filters.location
      if (filters.status) params.status = filters.status
      if (filters.dateFrom) params.date_from = filters.dateFrom
      if (filters.dateTo) params.date_to = filters.dateTo

      const response = await api.get('/safety/temperatures/', { params })
      setTemperatures(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || '온도 기록을 불러올 수 없습니다.')
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800'
      case 'critical':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getLocationColor = (location) => {
    switch (location) {
      case '냉동실':
        return 'bg-blue-50 border-blue-200'
      case '냉장실':
        return 'bg-cyan-50 border-cyan-200'
      case '조리용':
        return 'bg-orange-50 border-orange-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  // 날짜별로 그룹화
  const groupedByDate = temperatures.reduce((acc, temp) => {
    const date = new Date(temp.created_at).toLocaleDateString('ko-KR')
    if (!acc[date]) acc[date] = []
    acc[date].push(temp)
    return acc
  }, {})

  if (loading && temperatures.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">온도 기록 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">온도 기록</h1>
          <p className="text-gray-600 mt-1">매장의 모든 온도 기록을 조회합니다.</p>
        </div>
        <button
          onClick={() => navigate('/safety/temperatures/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + 온도 입력
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">필터</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">위치</label>
            <select
              name="location"
              value={filters.location}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 위치</option>
              <option value="냉동실">냉동실</option>
              <option value="냉장실">냉장실</option>
              <option value="조리용">조리용</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 상태</option>
              <option value="normal">정상</option>
              <option value="warning">경고</option>
              <option value="critical">위험</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작 날짜</label>
            <input
              type="date"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료 날짜</label>
            <input
              type="date"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 온도 기록 - 날짜별 그룹화 */}
      {temperatures.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-600 text-lg">온도 기록이 없습니다.</p>
          <button
            onClick={() => navigate('/safety/temperatures/new')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            첫 온도 기록 입력하기
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate)
            .reverse()
            .map(([date, temps]) => (
              <div key={date}>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{date}</h3>
                <div className="space-y-3">
                  {temps.map((temp) => (
                    <div
                      key={temp.id}
                      className={`bg-white rounded-lg shadow-sm p-6 border-l-4 transition ${getLocationColor(
                        temp.location
                      )}`}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                        {/* 위치 및 시간 */}
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600">위치</p>
                          <p className="text-lg font-semibold text-gray-900">{temp.location}</p>
                          <p className="text-sm text-gray-600 mt-2">
                            {new Date(temp.created_at).toLocaleTimeString('ko-KR')}
                          </p>
                        </div>

                        {/* 온도 정보 */}
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600">현재 온도</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {temp.temperature}°C
                          </p>
                          <p className="text-sm text-gray-600 mt-2">
                            표준: {temp.standard_temperature}°C
                          </p>
                        </div>

                        {/* 상태 */}
                        <div className="md:col-span-1">
                          <p className="text-sm text-gray-600">상태</p>
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-2 ${getStatusColor(
                              temp.status
                            )}`}
                          >
                            {temp.status === 'normal' && '정상'}
                            {temp.status === 'warning' && '경고'}
                            {temp.status === 'critical' && '위험'}
                          </span>
                        </div>

                        {/* 편차 */}
                        <div className="md:col-span-1">
                          <p className="text-sm text-gray-600">편차</p>
                          <p
                            className={`text-lg font-bold mt-2 ${
                              temp.status === 'critical'
                                ? 'text-red-600'
                                : temp.status === 'warning'
                                ? 'text-yellow-600'
                                : 'text-green-600'
                            }`}
                          >
                            {(temp.temperature - temp.standard_temperature > 0 ? '+' : '')}
                            {(temp.temperature - temp.standard_temperature).toFixed(1)}°C
                          </p>
                        </div>
                      </div>

                      {/* 비고 */}
                      {temp.notes && (
                        <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">비고:</span> {temp.notes}
                          </p>
                        </div>
                      )}

                      {/* 기록자 */}
                      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                        <span>기록자: {temp.recorded_by_name || '미지정'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 로딩 상태 */}
      {loading && temperatures.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

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
      setError(err.response?.data?.detail || '청소 기록을 불러올 수 없습니다.')
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

  const allAreas = [
    '주방',
    '화장실',
    '식당',
    '냉장고/냉동고',
    '조리 도구',
    '바닥',
    '벽/문',
    '쓰레기통',
    '기타'
  ]

  const getAreaBadgeColor = (area) => {
    const colors = {
      '주방': 'bg-red-100 text-red-800',
      '화장실': 'bg-blue-100 text-blue-800',
      '식당': 'bg-purple-100 text-purple-800',
      '냉장고/냉동고': 'bg-cyan-100 text-cyan-800',
      '조리 도구': 'bg-orange-100 text-orange-800',
      '바닥': 'bg-amber-100 text-amber-800',
      '벽/문': 'bg-emerald-100 text-emerald-800',
      '쓰레기통': 'bg-slate-100 text-slate-800',
      '기타': 'bg-gray-100 text-gray-800'
    }
    return colors[area] || 'bg-gray-100 text-gray-800'
  }

  if (loading && records.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        <p className="text-gray-600 mt-4">청소 기록 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">청소 이력</h1>
          <p className="text-gray-600 mt-1">과거 청소 기록을 조회하고 관리합니다.</p>
        </div>
        <button
          onClick={() => navigate('/safety/cleaning')}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          + 청소 기록 추가
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작 날짜</label>
            <input
              type="date"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료 날짜</label>
            <input
              type="date"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">청소 영역</label>
            <select
              name="area"
              value={filters.area}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">전체</option>
              {allAreas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleClearFilters}
          className="mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          필터 초기화
        </button>
      </div>

      {/* 청소 기록 목록 */}
      <div className="bg-white rounded-lg shadow-sm divide-y">
        {records.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">청소 기록이 없습니다.</p>
          </div>
        ) : (
          records.map(record => (
            <div key={record.id} className="p-6 hover:bg-gray-50 transition">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {/* 기본 정보 */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">청소 날짜</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(record.date).toLocaleDateString('ko-KR')}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    기록자: {record.created_by_name || '미지정'}
                  </p>
                </div>

                {/* 청소 영역 */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">청소 영역</p>
                  <div className="flex flex-wrap gap-1">
                    {record.area && record.area.split(', ').map(area => (
                      <span key={area} className={`inline-block px-2 py-1 rounded text-xs font-medium ${getAreaBadgeColor(area)}`}>
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 상태 및 증명 */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">상태</p>
                  {record.is_completed ? (
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                      ✓ 완료
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                      진행 중
                    </span>
                  )}
                  {record.attachment && (
                    <p className="text-xs text-blue-600 mt-2">
                      📎 {record.attachment.split('/').pop()}
                    </p>
                  )}
                </div>
              </div>

              {/* 비고 */}
              {record.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded border-l-4 border-green-500">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">비고:</span> {record.notes}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 로딩 상태 */}
      {loading && records.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
        </div>
      )}
    </div>
  )
}

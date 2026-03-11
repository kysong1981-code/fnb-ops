import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function ChecklistList() {
  const navigate = useNavigate()
  const [checklists, setChecklists] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: ''
  })

  useEffect(() => {
    fetchChecklists()
  }, [filters])

  const fetchChecklists = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filters.dateFrom) params.date_from = filters.dateFrom
      if (filters.dateTo) params.date_to = filters.dateTo
      if (filters.status) params.status = filters.status

      const response = await api.get('/safety/checklists/', { params })
      setChecklists(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || '체크리스트를 불러올 수 없습니다.')
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

  const getStatusBadgeColor = (isCompleted) => {
    return isCompleted
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800'
  }

  const getCompletionPercentage = (checklist) => {
    if (!checklist.responses) return 0
    const total = Object.keys(checklist.responses).length
    const completed = Object.values(checklist.responses).filter(v => v === true).length
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  if (loading && checklists.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">체크리스트 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">일일 안전 체크리스트</h1>
        <p className="text-gray-600 mt-1">매장의 시작 및 종료 단계별 안전 체크리스트 관리</p>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 필터 및 액션 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col gap-4">
          {/* 액션 버튼 */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">필터</h3>
            <button
              onClick={() => navigate('/safety/checklists/new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + 새 체크리스트 작성
            </button>
          </div>

          {/* 필터 입력 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">모든 상태</option>
                <option value="completed">완료</option>
                <option value="pending">진행 중</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 체크리스트 목록 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {checklists.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600 text-lg">체크리스트가 없습니다.</p>
            <p className="text-gray-500 text-sm mt-2">새 체크리스트를 작성하여 시작하세요.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">날짜</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">템플릿</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">담당자</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">완료율</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">상태</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {checklists.map((checklist) => {
                const completionPct = getCompletionPercentage(checklist)
                return (
                  <tr key={checklist.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(checklist.date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {checklist.template_name || '템플릿 정보 없음'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {checklist.completed_by_name || '미배정'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              completionPct === 100 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-10 text-right">
                          {completionPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                          checklist.is_completed
                        )}`}
                      >
                        {checklist.is_completed ? '완료' : '진행 중'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => navigate(`/safety/checklists/${checklist.id}`)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium transition"
                        >
                          상세
                        </button>
                        {!checklist.is_completed && (
                          <button
                            onClick={() => navigate(`/safety/checklists/${checklist.id}`)}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-medium transition"
                          >
                            완료
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 로딩 상태 표시 */}
      {loading && checklists.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

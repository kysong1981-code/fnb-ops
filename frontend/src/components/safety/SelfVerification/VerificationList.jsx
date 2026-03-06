import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function VerificationList() {
  const navigate = useNavigate()
  const [verifications, setVerifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    frequency: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => {
    fetchVerifications()
  }, [filters])

  const fetchVerifications = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filters.frequency) params.frequency = filters.frequency
      if (filters.dateFrom) params.date_from = filters.dateFrom
      if (filters.dateTo) params.date_to = filters.dateTo

      const response = await api.get('/safety/verifications/', { params })
      setVerifications(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || '검증 기록을 불러올 수 없습니다.')
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
      frequency: '',
      dateFrom: '',
      dateTo: ''
    })
  }

  const getFrequencyLabel = (frequency) => {
    const labels = {
      'weekly': '주간',
      'monthly': '월간',
      'quarterly': '분기별'
    }
    return labels[frequency] || frequency
  }

  const getComplianceScoreColor = (score) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getComplianceBgColor = (score) => {
    if (score >= 90) return 'bg-green-50 border-l-4 border-green-500'
    if (score >= 70) return 'bg-yellow-50 border-l-4 border-yellow-500'
    return 'bg-red-50 border-l-4 border-red-500'
  }

  if (loading && verifications.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">검증 기록 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">자체 검증 기록</h1>
          <p className="text-gray-600 mt-1">정기 안전 검증 기록을 조회합니다.</p>
        </div>
        <button
          onClick={() => navigate('/safety/verifications')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + 새 검증 시작
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">필터</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">검증 주기</label>
            <select
              name="frequency"
              value={filters.frequency}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              <option value="weekly">주간</option>
              <option value="monthly">월간</option>
              <option value="quarterly">분기별</option>
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

        <button
          onClick={handleClearFilters}
          className="mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          필터 초기화
        </button>
      </div>

      {/* 검증 기록 목록 */}
      <div className="space-y-4">
        {verifications.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600 mb-4">완료된 검증이 없습니다.</p>
            <button
              onClick={() => navigate('/safety/verifications')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              첫 검증 시작하기
            </button>
          </div>
        ) : (
          verifications.map(verification => (
            <div
              key={verification.id}
              className={`rounded-lg p-6 ${getComplianceBgColor(verification.compliance_score || 0)}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                {/* 기본 정보 */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">검증 주기</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {getFrequencyLabel(verification.frequency)}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    {new Date(verification.period_start).toLocaleDateString('ko-KR')} ~{' '}
                    {new Date(verification.period_end).toLocaleDateString('ko-KR')}
                  </p>
                </div>

                {/* 규정 준수 점수 */}
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">규정 준수 점수</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <p className={`text-3xl font-bold ${getComplianceScoreColor(verification.compliance_score || 0)}`}>
                        {verification.compliance_score || 0}
                      </p>
                      <p className="text-gray-600">%</p>
                    </div>
                  </div>
                </div>

                {/* 검증자 및 완료 */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">검증자</p>
                  <p className="text-base font-medium text-gray-900">
                    {verification.verified_by_name || '미지정'}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    완료: {new Date(verification.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>

                {/* 액션 */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => navigate(`/safety/verifications/${verification.id}`)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
                  >
                    상세보기
                  </button>
                  {verification.pdf_url && (
                    <a
                      href={verification.pdf_url}
                      download
                      className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm font-medium"
                    >
                      PDF
                    </a>
                  )}
                </div>
              </div>

              {/* 발견사항 프리뷰 */}
              {verification.findings && (
                <div className="mt-4 pt-4 border-t border-opacity-30">
                  <p className="text-xs font-semibold text-gray-700 mb-1">주요 발견사항</p>
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {verification.findings}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 로딩 상태 */}
      {loading && verifications.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

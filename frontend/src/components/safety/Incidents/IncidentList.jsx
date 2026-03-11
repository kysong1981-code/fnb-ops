import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function IncidentList() {
  const navigate = useNavigate()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    type: ''
  })

  useEffect(() => {
    fetchIncidents()
  }, [filters])

  const fetchIncidents = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.severity) params.severity = filters.severity
      if (filters.type) params.incident_type = filters.type

      const response = await api.get('/safety/incidents/', { params })
      setIncidents(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || '사건을 불러올 수 없습니다.')
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

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'critical':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'reported':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTypeLabel = (type) => {
    const types = {
      customer_complaint: '고객 불만',
      food_safety: '식품 안전',
      hygiene: '위생',
      equipment: '장비',
      training: '교육',
      other: '기타'
    }
    return types[type] || type
  }

  const openCount = incidents.filter(i => i.status !== 'closed').length
  const criticalCount = incidents.filter(i => i.severity === 'critical').length

  if (loading && incidents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">사건 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">안전 사건 관리</h1>
          <p className="text-gray-600 mt-1">음식 안전, 고객 불만, 위생 관련 사건을 기록하고 관리합니다.</p>
        </div>
        <button
          onClick={() => navigate('/safety/incidents/new')}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          + 새 사건 보고
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">전체 사건</h3>
          <div className="text-3xl font-bold text-blue-600">{incidents.length}</div>
          <p className="text-sm text-gray-600 mt-2">보고된 사건</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">미해결</h3>
          <div className="text-3xl font-bold text-orange-600">{openCount}</div>
          <p className="text-sm text-gray-600 mt-2">해결 대기</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">위험</h3>
          <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
          <p className="text-sm text-gray-600 mt-2">심각한 사건</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">해결율</h3>
          <div className="text-3xl font-bold text-green-600">
            {incidents.length > 0
              ? Math.round(
                  ((incidents.length - openCount) / incidents.length) * 100
                )
              : 0}
            %
          </div>
          <p className="text-sm text-gray-600 mt-2">해결된 사건</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">필터</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 상태</option>
              <option value="reported">보고됨</option>
              <option value="investigating">조사 중</option>
              <option value="resolved">해결됨</option>
              <option value="closed">종료됨</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">심각도</label>
            <select
              name="severity"
              value={filters.severity}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 심각도</option>
              <option value="low">낮음</option>
              <option value="medium">중간</option>
              <option value="high">높음</option>
              <option value="critical">심각</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
            <select
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 유형</option>
              <option value="customer_complaint">고객 불만</option>
              <option value="food_safety">식품 안전</option>
              <option value="hygiene">위생</option>
              <option value="equipment">장비</option>
              <option value="training">교육</option>
              <option value="other">기타</option>
            </select>
          </div>
        </div>
      </div>

      {/* 사건 목록 */}
      <div className="space-y-4">
        {incidents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600 text-lg">보고된 사건이 없습니다.</p>
            <p className="text-green-600 font-semibold mt-2">✓ 시스템 정상</p>
          </div>
        ) : (
          incidents.map((incident) => (
            <div
              key={incident.id}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-lg transition border-l-4 border-gray-300"
            >
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                {/* 제목 및 설명 */}
                <div className="md:col-span-2">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    {incident.title}
                  </h4>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {incident.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    보고: {new Date(incident.reported_at).toLocaleString('ko-KR')}
                  </p>
                </div>

                {/* 유형 및 심각도 */}
                <div className="flex flex-col gap-2">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold w-max">
                    {getTypeLabel(incident.incident_type)}
                  </span>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold w-max ${getSeverityColor(
                      incident.severity
                    )}`}
                  >
                    {incident.severity === 'low' && '낮음'}
                    {incident.severity === 'medium' && '중간'}
                    {incident.severity === 'high' && '높음'}
                    {incident.severity === 'critical' && '심각'}
                  </span>
                </div>

                {/* 상태 */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">상태</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                      incident.status
                    )}`}
                  >
                    {incident.status === 'reported' && '보고됨'}
                    {incident.status === 'investigating' && '조사 중'}
                    {incident.status === 'resolved' && '해결됨'}
                    {incident.status === 'closed' && '종료됨'}
                  </span>
                </div>

                {/* 열린 기간 또는 해결자 */}
                <div className="text-right">
                  {incident.status !== 'closed' && (
                    <div>
                      <p className="text-sm text-gray-600">{incident.days_open}일 개방</p>
                      <button
                        onClick={() => navigate(`/safety/incidents/${incident.id}`)}
                        className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium transition"
                      >
                        상세 보기
                      </button>
                    </div>
                  )}
                  {incident.status === 'closed' && (
                    <div>
                      <p className="text-sm text-gray-600">종료됨</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {incident.resolved_by_name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 로딩 상태 */}
      {loading && incidents.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

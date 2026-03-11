import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../../services/api'

export default function IncidentDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [incident, setIncident] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isResolving, setIsResolving] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')

  useEffect(() => {
    fetchIncident()
  }, [id])

  const fetchIncident = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/safety/incidents/${id}/`)
      setIncident(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || '사건을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      setError('해결 노트를 입력해주세요.')
      return
    }

    setIsResolving(true)
    setError('')
    try {
      await api.patch(`/safety/incidents/${id}/resolve/`, {
        resolution_notes: resolutionNotes
      })
      setSuccess('사건이 해결되었습니다.')
      setTimeout(() => {
        navigate('/safety/incidents')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || '해결 처리에 실패했습니다.')
    } finally {
      setIsResolving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">사건 로드 중...</p>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="space-y-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error || '사건을 찾을 수 없습니다.'}
        </div>
      </div>
    )
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
        return 'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500'
      case 'resolved':
        return 'bg-green-100 text-green-800 border-l-4 border-green-500'
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-l-4 border-gray-500'
      default:
        return 'bg-gray-100 text-gray-800'
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

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{incident.title}</h1>
          <p className="text-gray-600 mt-1">
            보고: {new Date(incident.reported_at).toLocaleString('ko-KR')} by {incident.reported_by_name}
          </p>
        </div>
        <button
          onClick={() => navigate('/safety/incidents')}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ✕
        </button>
      </div>

      {/* 에러/성공 메시지 */}
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

      {/* 상태 요약 */}
      <div className={`rounded-lg shadow-sm p-6 ${getStatusColor(incident.status)}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium opacity-75 mb-1">상태</p>
            <p className="text-xl font-bold">
              {incident.status === 'reported' && '보고됨'}
              {incident.status === 'investigating' && '조사 중'}
              {incident.status === 'resolved' && '해결됨'}
              {incident.status === 'closed' && '종료됨'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium opacity-75 mb-1">심각도</p>
            <p className="text-xl font-bold">
              {incident.severity === 'low' && '낮음'}
              {incident.severity === 'medium' && '중간'}
              {incident.severity === 'high' && '높음'}
              {incident.severity === 'critical' && '심각'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium opacity-75 mb-1">유형</p>
            <p className="text-xl font-bold">{getTypeLabel(incident.incident_type)}</p>
          </div>
          <div>
            <p className="text-sm font-medium opacity-75 mb-1">열린 기간</p>
            <p className="text-xl font-bold">{incident.days_open}일</p>
          </div>
        </div>
      </div>

      {/* 설명 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">상세 설명</h3>
        <p className="text-gray-700 whitespace-pre-wrap">{incident.description}</p>
      </div>

      {/* 해결 정보 (해결됨/종료됨인 경우) */}
      {(incident.status === 'resolved' || incident.status === 'closed') && incident.resolution_notes && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-3">해결 내용</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-green-700 mb-1">해결자</p>
              <p className="font-semibold text-green-900">{incident.resolved_by_name || '미지정'}</p>
            </div>
            <div>
              <p className="text-sm text-green-700 mb-1">해결 일시</p>
              <p className="font-semibold text-green-900">
                {incident.resolved_at
                  ? new Date(incident.resolved_at).toLocaleString('ko-KR')
                  : '미지정'}
              </p>
            </div>
          </div>
          <p className="text-gray-700 whitespace-pre-wrap bg-white rounded p-3 border border-green-200">
            {incident.resolution_notes}
          </p>
        </div>
      )}

      {/* 해결 폼 (미해결인 경우) */}
      {incident.status !== 'closed' && incident.status !== 'resolved' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">사건 해결</h3>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">현재 상태:</span> {getTypeLabel(incident.incident_type)} -
              <span className={`ml-2 inline-block px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(
                incident.severity
              )}`}>
                {incident.severity === 'low' && '낮음'}
                {incident.severity === 'medium' && '중간'}
                {incident.severity === 'high' && '높음'}
                {incident.severity === 'critical' && '심각'}
              </span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              해결 노트 <span className="text-red-600">*</span>
            </label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="사건 해결 방법, 취한 조치, 예방 계획을 입력하세요."
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mt-4 flex gap-2 justify-end">
            <button
              onClick={() => navigate('/safety/incidents')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleResolve}
              disabled={isResolving || !resolutionNotes.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResolving ? '처리 중...' : '해결 완료'}
            </button>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      {incident.status !== 'closed' && incident.status !== 'resolved' && (
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => navigate('/safety/incidents')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            목록으로
          </button>
          <button
            onClick={() => navigate(`/safety/incidents/${id}/edit`)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            수정
          </button>
        </div>
      )}

      {/* 목록 버튼 (해결됨/종료됨) */}
      {(incident.status === 'closed' || incident.status === 'resolved') && (
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/safety/incidents')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            목록으로
          </button>
        </div>
      )}
    </div>
  )
}

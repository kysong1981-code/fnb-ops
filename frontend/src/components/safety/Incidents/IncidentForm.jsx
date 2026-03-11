import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../../services/api'

export default function IncidentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium',
    incident_type: 'customer_complaint',
    reported_by: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (isEditMode) {
      fetchIncident()
    }
  }, [isEditMode, id])

  const fetchIncident = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/safety/incidents/${id}/`)
      setFormData({
        title: response.data.title,
        description: response.data.description,
        severity: response.data.severity,
        incident_type: response.data.incident_type,
        reported_by: response.data.reported_by || ''
      })
    } catch (err) {
      setError(err.response?.data?.detail || '사건을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
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
        title: formData.title,
        description: formData.description,
        severity: formData.severity,
        incident_type: formData.incident_type
      }

      if (isEditMode) {
        await api.patch(`/safety/incidents/${id}/`, data)
        setSuccess('사건이 업데이트되었습니다.')
      } else {
        await api.post('/safety/incidents/', data)
        setSuccess('사건이 보고되었습니다.')
      }

      setTimeout(() => {
        navigate('/safety/incidents')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && isEditMode) {
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? '사건 수정' : '새 사건 보고'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditMode ? '사건 정보를 수정합니다.' : '음식 안전 관련 사건을 보고합니다.'}
        </p>
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
          <h3 className="text-lg font-semibold text-gray-900">사건 정보</h3>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="사건의 제목을 입력하세요"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상세 설명 <span className="text-red-600">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="사건의 자세한 내용을 입력하세요."
              rows="5"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 유형 및 심각도 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사건 유형 <span className="text-red-600">*</span>
              </label>
              <select
                name="incident_type"
                value={formData.incident_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="customer_complaint">고객 불만</option>
                <option value="food_safety">식품 안전</option>
                <option value="hygiene">위생</option>
                <option value="equipment">장비</option>
                <option value="training">교육</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                심각도 <span className="text-red-600">*</span>
              </label>
              <select
                name="severity"
                value={formData.severity}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">낮음</option>
                <option value="medium">중간</option>
                <option value="high">높음</option>
                <option value="critical">심각</option>
              </select>
            </div>
          </div>
        </div>

        {/* 심각도 정보 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">심각도 가이드</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><span className="font-semibold">낮음:</span> 경미한 문제, 즉시 조치 필요 없음</li>
            <li><span className="font-semibold">중간:</span> 주의 필요, 24시간 내 조사</li>
            <li><span className="font-semibold">높음:</span> 심각한 문제, 즉시 조사 필요</li>
            <li><span className="font-semibold">심각:</span> 긴급, 즉시 대응 필요</li>
          </ul>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate('/safety/incidents')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading || !formData.title || !formData.description}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : isEditMode ? '수정' : '보고'}
          </button>
        </div>
      </form>
    </div>
  )
}

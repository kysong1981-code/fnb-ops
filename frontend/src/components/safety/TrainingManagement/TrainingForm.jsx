import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function TrainingForm() {
  const navigate = useNavigate()

  const [staff, setStaff] = useState([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    validity_months: 12,
    participants: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      // 직원 목록 조회 (HR 모듈)
      const response = await api.get('/hr/staff/')
      setStaff(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      // 기본 직원 목록이 없으면 빈 상태로 계속
      setStaff([])
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'validity_months' ? parseInt(value) : value
    }))
  }

  const handleParticipantToggle = (staffId) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.includes(staffId)
        ? prev.participants.filter(id => id !== staffId)
        : [...prev.participants, staffId]
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
        date: formData.date,
        validity_months: formData.validity_months,
        participants: formData.participants
      }

      await api.post('/safety/training/', data)
      setSuccess('교육이 등록되었습니다.')

      setTimeout(() => {
        navigate('/safety/training')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">교육 등록</h1>
        <p className="text-gray-600 mt-1">직원 안전 교육을 등록하고 이수 현황을 추적합니다.</p>
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

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">교육 정보</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              교육명 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="예: Food Safety Level 2"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="교육 내용을 입력하세요."
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">교육 날짜</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유효 기간 (개월)</label>
              <input
                type="number"
                name="validity_months"
                value={formData.validity_months}
                onChange={handleInputChange}
                min="1"
                max="60"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                만료 예정: {new Date(new Date(formData.date).setMonth(new Date(formData.date).getMonth() + formData.validity_months)).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
        </div>

        {/* 참여자 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">참여 직원</h3>

          {staff.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded text-center text-gray-600">
              <p>등록된 직원이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {staff.map(s => (
                <label key={s.id} className="flex items-center p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.participants.includes(s.id)}
                    onChange={() => handleParticipantToggle(s.id)}
                    className="h-5 w-5 text-blue-600 border-gray-300 rounded cursor-pointer"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    {s.user?.first_name || s.name} ({s.user?.username || s.id})
                  </span>
                </label>
              ))}
            </div>
          )}

          {formData.participants.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">선택된 직원: {formData.participants.length}명</span>
              </p>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate('/safety/training')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading || !formData.title}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : '등록'}
          </button>
        </div>
      </form>
    </div>
  )
}

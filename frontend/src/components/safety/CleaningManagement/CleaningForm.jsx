import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function CleaningForm() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    areas: [],
    notes: '',
    date: new Date().toISOString().split('T')[0]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const cleaningAreas = [
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

  const handleAreaToggle = (area) => {
    setFormData(prev => ({
      ...prev,
      areas: prev.areas.includes(area)
        ? prev.areas.filter(a => a !== area)
        : [...prev.areas, area]
    }))
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
        date: formData.date,
        area: formData.areas.join(', '),
        notes: formData.notes,
        is_completed: true
      }

      await api.post('/safety/cleaning/', data)
      setSuccess('청소 기록이 저장되었습니다.')

      setTimeout(() => {
        navigate('/safety/cleaning')
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
        <h1 className="text-3xl font-bold text-gray-900">청소 완료 기록</h1>
        <p className="text-gray-600 mt-1">오늘 수행한 청소 작업을 기록합니다.</p>
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
          <h3 className="text-lg font-semibold text-gray-900">기본 정보</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 청소 영역 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">청소 영역</h3>
          <p className="text-sm text-gray-600 mb-4">청소한 영역을 모두 선택하세요</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cleaningAreas.map(area => (
              <label
                key={area}
                className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition ${
                  formData.areas.includes(area)
                    ? 'bg-green-50 border-green-500'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.areas.includes(area)}
                  onChange={() => handleAreaToggle(area)}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                />
                <span className="ml-3 text-sm font-medium text-gray-900">{area}</span>
              </label>
            ))}
          </div>

          {formData.areas.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
              <p className="text-sm text-green-800">
                <span className="font-semibold">선택된 영역:</span> {formData.areas.join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* 추가 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">추가 정보</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="4"
              placeholder="사용한 청소 자재, 특이사항 등을 입력하세요."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate('/safety/cleaning')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading || formData.areas.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

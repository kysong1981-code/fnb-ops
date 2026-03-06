import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function VerificationForm() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    frequency: 'weekly',
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
    findings: '',
    corrective_actions: '',
    responses: {}
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const checklistItems = [
    { id: 'temp', label: '냉장고/냉동고 온도' },
    { id: 'cleaning', label: '청소 기록 확인' },
    { id: 'training', label: '직원 교육 현황' },
    { id: 'incidents', label: '사건 기록 검토' },
    { id: 'supplies', label: '안전 용품 비축' },
    { id: 'documents', label: '문서 정리' }
  ]

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleResponseChange = (itemId, value) => {
    setFormData(prev => ({
      ...prev,
      responses: {
        ...prev.responses,
        [itemId]: value
      }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = {
        frequency: formData.frequency,
        period_start: formData.period_start,
        period_end: formData.period_end,
        findings: formData.findings,
        corrective_actions: formData.corrective_actions,
        responses: formData.responses
      }

      await api.post('/safety/verifications/', data)
      setSuccess('검증이 저장되었습니다.')

      setTimeout(() => {
        navigate('/safety/verifications')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const completionCount = Object.values(formData.responses).filter(v => v === true).length
  const completionPercentage = checklistItems.length > 0
    ? Math.round((completionCount / checklistItems.length) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">자체 검증 작성</h1>
        <p className="text-gray-600 mt-1">정기적인 안전 검증을 수행하고 규정 준수를 확인합니다.</p>
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
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">검증 정보</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">검증 주기</label>
              <select
                name="frequency"
                value={formData.frequency}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="weekly">주간</option>
                <option value="monthly">월간</option>
                <option value="quarterly">분기별</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작 날짜</label>
              <input
                type="date"
                name="period_start"
                value={formData.period_start}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료 날짜</label>
              <input
                type="date"
                name="period_end"
                value={formData.period_end}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 체크리스트 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">검증 체크리스트</h3>

          <div className="space-y-3 mb-4">
            {checklistItems.map((item, idx) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border-2 transition ${
                  formData.responses[item.id]
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.responses[item.id] || false}
                    onChange={(e) => handleResponseChange(item.id, e.target.checked)}
                    className="h-5 w-5 text-blue-600 border-gray-300 rounded cursor-pointer"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    {idx + 1}. {item.label}
                  </span>
                  {formData.responses[item.id] && (
                    <span className="ml-auto text-green-600 font-bold">✓</span>
                  )}
                </label>
              </div>
            ))}
          </div>

          {/* 완료율 */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-blue-900">완료율</span>
              <span className="text-2xl font-bold text-blue-600">{completionPercentage}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* 발견사항 및 개선 계획 */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">발견사항 및 개선</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발견사항</label>
            <textarea
              name="findings"
              value={formData.findings}
              onChange={handleInputChange}
              placeholder="검증 중 발견된 문제점을 기록하세요."
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">개선 계획</label>
            <textarea
              name="corrective_actions"
              value={formData.corrective_actions}
              onChange={handleInputChange}
              placeholder="발견된 문제를 해결하기 위한 개선 계획을 입력하세요."
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate('/safety/verifications')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading || completionPercentage < 100}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={completionPercentage < 100 ? '모든 항목을 확인해야 합니다.' : ''}
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

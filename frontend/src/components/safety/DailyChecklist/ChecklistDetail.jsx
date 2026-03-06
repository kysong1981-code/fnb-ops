import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../../services/api'

export default function ChecklistDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [checklist, setChecklist] = useState(null)
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isCompleting, setIsCompleting] = useState(false)

  useEffect(() => {
    fetchChecklist()
  }, [id])

  const fetchChecklist = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/safety/checklists/${id}/`)
      setChecklist(response.data)

      // 템플릿 정보 가져오기
      if (response.data.template) {
        const templateResponse = await api.get(`/safety/checklist-templates/${response.data.template}/`)
        setTemplate(templateResponse.data)
      }
    } catch (err) {
      setError(err.response?.data?.detail || '체크리스트를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    setIsCompleting(true)
    setError('')
    try {
      await api.post(`/safety/checklists/${id}/complete/`)
      setSuccess('체크리스트가 완료되었습니다.')
      setTimeout(() => {
        navigate('/safety/checklists')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || '완료 처리에 실패했습니다.')
    } finally {
      setIsCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">체크리스트 로드 중...</p>
      </div>
    )
  }

  if (!checklist) {
    return (
      <div className="space-y-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error || '체크리스트를 찾을 수 없습니다.'}
        </div>
      </div>
    )
  }

  const completionPercentage = template
    ? Math.round(
        (Object.values(checklist.responses).filter(v => v === true).length /
          template.items.length) *
          100
      )
    : 0

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">체크리스트 상세</h1>
          <p className="text-gray-600 mt-1">{new Date(checklist.date).toLocaleDateString('ko-KR')}</p>
        </div>
        <button
          onClick={() => navigate('/safety/checklists')}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ✕
        </button>
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

      {/* 체크리스트 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 상태 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">상태</h3>
          <div className={`text-2xl font-bold ${checklist.is_completed ? 'text-green-600' : 'text-yellow-600'}`}>
            {checklist.is_completed ? '완료' : '진행 중'}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {checklist.is_completed ? '작성 완료됨' : '작성 진행 중'}
          </p>
        </div>

        {/* 완료율 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">완료율</h3>
          <div className="text-2xl font-bold text-green-600">{completionPercentage}%</div>
          <p className="text-sm text-gray-600 mt-2">항목 완료</p>
        </div>

        {/* 작성자 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">작성자</h3>
          <div className="text-lg font-semibold text-gray-900">{checklist.completed_by_name || '미배정'}</div>
          <p className="text-sm text-gray-600 mt-2">담당자</p>
        </div>

        {/* 작성일시 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">작성일시</h3>
          <div className="text-sm font-semibold text-gray-900">
            {checklist.completed_at
              ? new Date(checklist.completed_at).toLocaleString('ko-KR')
              : '미완료'}
          </div>
          <p className="text-sm text-gray-600 mt-2">완료 시간</p>
        </div>
      </div>

      {/* 템플릿 정보 및 항목 */}
      {template && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">템플릿: {template.name}</h3>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  completionPercentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* 체크리스트 항목 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">체크리스트 항목</h4>
            {template.items.map((item, idx) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border-2 transition ${
                  checklist.responses[item.id]
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start">
                  <div
                    className={`flex-shrink-0 mt-1 h-6 w-6 rounded-full flex items-center justify-center ${
                      checklist.responses[item.id]
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {checklist.responses[item.id] ? '✓' : '○'}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {idx + 1}. {item.description || `항목 ${item.id}`}
                    </p>
                    {item.required && (
                      <p className="text-xs text-red-600 mt-1">* 필수 항목</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 비고 */}
      {checklist.notes && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">비고</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{checklist.notes}</p>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={() => navigate('/safety/checklists')}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
        >
          목록으로
        </button>

        {!checklist.is_completed && (
          <>
            <button
              onClick={() => navigate(`/safety/checklists/${id}/edit`)}
              className="px-6 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition font-medium"
            >
              편집
            </button>
            <button
              onClick={handleComplete}
              disabled={isCompleting || completionPercentage < 100}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={completionPercentage < 100 ? '모든 항목을 완료해야 합니다.' : ''}
            >
              {isCompleting ? '완료 처리 중...' : '완료 처리'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

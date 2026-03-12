import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../../services/api'
import { getTodayNZ } from '../../../utils/date'

export default function ChecklistForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const [templates, setTemplates] = useState([])
  const [formData, setFormData] = useState({
    template: '',
    date: getTodayNZ(),
    responses: {},
    notes: ''
  })
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchTemplates()
    if (isEditMode) {
      fetchChecklist()
    }
  }, [isEditMode, id])

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/safety/checklist-templates/')
      setTemplates(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      setError('템플릿을 불러올 수 없습니다.')
    }
  }

  const fetchChecklist = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/safety/checklists/${id}/`)
      const checklist = response.data
      setFormData({
        template: checklist.template,
        date: checklist.date,
        responses: checklist.responses || {},
        notes: checklist.notes || ''
      })
      // 템플릿 찾기
      const template = templates.find(t => t.id === checklist.template)
      setSelectedTemplate(template)
    } catch (err) {
      setError(err.response?.data?.detail || '체크리스트를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateChange = (e) => {
    const templateId = parseInt(e.target.value)
    const template = templates.find(t => t.id === templateId)
    setSelectedTemplate(template)
    setFormData(prev => ({
      ...prev,
      template: templateId,
      responses: template?.items
        ? template.items.reduce((acc, item) => {
            acc[item.id] = false
            return acc
          }, {})
        : {}
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
        template: formData.template,
        date: formData.date,
        responses: formData.responses,
        notes: formData.notes
      }

      if (isEditMode) {
        await api.patch(`/safety/checklists/${id}/`, data)
        setSuccess('체크리스트가 업데이트되었습니다.')
      } else {
        await api.post('/safety/checklists/', data)
        setSuccess('체크리스트가 저장되었습니다.')
      }

      setTimeout(() => {
        navigate('/safety/checklists')
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
        <p className="text-gray-600 mt-4">체크리스트 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? '체크리스트 수정' : '새 체크리스트 작성'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditMode ? '기존 체크리스트를 수정합니다.' : '안전 체크리스트를 작성합니다.'}
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
          <h3 className="text-lg font-semibold text-gray-900">기본 정보</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">템플릿</label>
              <select
                value={formData.template}
                onChange={handleTemplateChange}
                disabled={isEditMode}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">템플릿을 선택하세요</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="3"
              placeholder="추가 사항이나 특이사항을 입력하세요."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 체크리스트 항목 */}
        {selectedTemplate && selectedTemplate.items && (
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">체크리스트 항목</h3>
            <p className="text-sm text-gray-600">아래 항목들을 확인하고 체크합니다.</p>

            <div className="space-y-3">
              {selectedTemplate.items.map((item, idx) => (
                <div key={item.id} className="flex items-start p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    id={`item-${item.id}`}
                    checked={formData.responses[item.id] || false}
                    onChange={(e) => handleResponseChange(item.id, e.target.checked)}
                    className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                  <label
                    htmlFor={`item-${item.id}`}
                    className="ml-3 flex-1 cursor-pointer"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {idx + 1}. {item.description || `항목 ${item.id}`}
                    </p>
                    {item.required && (
                      <p className="text-xs text-red-600 mt-1">* 필수 항목</p>
                    )}
                  </label>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      formData.responses[item.id]
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {formData.responses[item.id] ? '✓' : '○'}
                  </span>
                </div>
              ))}
            </div>

            {/* 완료율 표시 */}
            {selectedTemplate.items.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">완료율</span>
                  <span className="text-lg font-bold text-blue-600">
                    {Math.round(
                      (Object.values(formData.responses).filter(v => v === true).length /
                        selectedTemplate.items.length) *
                        100
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${
                        (Object.values(formData.responses).filter(v => v === true).length /
                          selectedTemplate.items.length) *
                        100
                      }%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate('/safety/checklists')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading || !formData.template}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : isEditMode ? '수정' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

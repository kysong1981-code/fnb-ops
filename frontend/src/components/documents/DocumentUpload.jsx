import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function DocumentUpload() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    document_type: 'OTHER',
    category: '',
    file: null,
    is_public: true
  })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const documentTypes = [
    { value: 'CONTRACT', label: '계약서' },
    { value: 'JOB_DESCRIPTION', label: '직무기술서' },
    { value: 'JOB_OFFER', label: '채용제안' },
    { value: 'POLICY', label: '정책' },
    { value: 'MANUAL', label: '매뉴얼' },
    { value: 'TRAINING', label: '교육' },
    { value: 'SAFETY', label: '안전' },
    { value: 'OTHER', label: '기타' }
  ]

  // 카테고리 조회
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/documents/categories/')
        setCategories(response.data || [])
      } catch (err) {
        console.error('카테고리 조회 실패:', err)
      }
    }
    fetchCategories()
  }, [])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // 파일 크기 검증 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('파일 크기는 5MB 이하여야 합니다')
        return
      }

      // 파일 형식 검증
      const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      const allowedExtensions = ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png']
      const fileExtension = file.name.split('.').pop().toLowerCase()

      if (!allowedExtensions.includes(fileExtension)) {
        setError('지원하지 않는 파일 형식입니다 (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG만 가능)')
        return
      }

      setError('')
      setFormData(prev => ({
        ...prev,
        file
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 필수 필드 검증
    if (!formData.title.trim()) {
      setError('제목을 입력해주세요')
      setLoading(false)
      return
    }

    if (!formData.file) {
      setError('파일을 선택해주세요')
      setLoading(false)
      return
    }

    const submitFormData = new FormData()
    submitFormData.append('title', formData.title)
    submitFormData.append('description', formData.description)
    submitFormData.append('document_type', formData.document_type)
    if (formData.category) {
      submitFormData.append('category', formData.category)
    }
    submitFormData.append('file', formData.file)
    submitFormData.append('is_public', formData.is_public)

    try {
      const response = await api.post('/documents/documents/', submitFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setSuccess('문서가 업로드되었습니다')
      setTimeout(() => {
        navigate(`/documents/${response.data.id}`)
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || '업로드 실패: ' + JSON.stringify(err.response?.data || err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">문서 업로드</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="문서 제목을 입력해주세요"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="문서에 대한 설명을 입력해주세요 (선택사항)"
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* 문서 타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              문서 타입 *
            </label>
            <select
              name="document_type"
              value={formData.document_type}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {documentTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">카테고리 선택 (선택사항)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* 파일 업로드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              파일 *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer">
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.txt"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📁</div>
                <p className="text-gray-700 font-medium">
                  클릭하여 파일을 선택하거나 드래그해서 놓으세요
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (최대 5MB)
                </p>
                {formData.file && (
                  <p className="text-sm text-green-600 mt-2">
                    선택된 파일: {formData.file.name}
                  </p>
                )}
              </label>
            </div>
          </div>

          {/* 공개 여부 */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_public"
              id="is_public"
              checked={formData.is_public}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="is_public" className="ml-2 block text-sm text-gray-700">
              공개 문서 (체크 해제 시 매니저만 접근 가능)
            </label>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* 성공 메시지 */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
              {success}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
            >
              {loading ? '업로드 중...' : '업로드'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/documents')}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import DocumentCard from './DocumentCard'

export default function DocumentList({ documentType = null, refreshTrigger = 0 }) {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [sortBy, setSortBy] = useState('-created_at')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

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

  // 문서 조회
  useEffect(() => {
    fetchDocuments()
  }, [documentType, filterCategory, sortBy, page, searchQuery, refreshTrigger])

  const fetchDocuments = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {
        page,
        search: searchQuery,
        ordering: sortBy
      }

      if (documentType) {
        params.document_type = documentType
      }

      if (filterCategory) {
        params.category = filterCategory
      }

      const response = await api.get('/documents/documents/', { params })

      const data = response.data
      if (data.results) {
        // Paginated response
        setDocuments(data.results)
        setTotalPages(Math.ceil(data.count / 10))
      } else if (Array.isArray(data)) {
        // Non-paginated response
        setDocuments(data)
        setTotalPages(1)
      } else {
        setDocuments([])
        setTotalPages(1)
      }
    } catch (err) {
      setError(err.response?.data?.detail || '문서 조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 문서를 삭제하시겠습니까?')) return

    try {
      await api.delete(`/documents/documents/${id}/`)
      setDocuments(documents.filter(d => d.id !== id))
    } catch (err) {
      alert('삭제 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다'))
    }
  }

  if (loading && documents.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 검색 */}
          <div>
            <input
              type="text"
              placeholder="제목 또는 설명 검색..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* 카테고리 필터 */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">모든 카테고리</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* 정렬 */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="-created_at">최신순</option>
              <option value="title">제목순</option>
              <option value="-version">버전순</option>
            </select>
          </div>

          {/* 초기화 */}
          <button
            onClick={() => {
              setSearchQuery('')
              setFilterCategory('')
              setSortBy('-created_at')
              setPage(1)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {/* 문서 그리드 */}
      {documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500 text-lg">문서가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={() => navigate(`/documents/${doc.id}`)}
              onDelete={() => handleDelete(doc.id)}
            />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
          >
            이전
          </button>
          <span className="px-4 py-2 text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}

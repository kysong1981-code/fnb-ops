import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const documentTypeLabels = {
  CONTRACT: '계약서',
  JOB_DESCRIPTION: '직무기술서',
  JOB_OFFER: '채용제안',
  POLICY: '정책',
  MANUAL: '매뉴얼',
  TRAINING: '교육',
  SAFETY: '안전',
  OTHER: '기타'
}

export default function DocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchDocument()
  }, [id])

  const fetchDocument = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/documents/documents/${id}/`)
      setDocument(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || '문서 조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      // 다운로드 이력 기록
      await api.post(`/documents/documents/${id}/download/`)

      // 파일 다운로드
      const fileUrl = document.file
      const link = document.createElement('a')
      link.href = fileUrl
      link.target = '_blank'
      link.download = document.file.split('/').pop()
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // 다운로드 수 업데이트
      setDocument(prev => ({
        ...prev,
        download_count: (prev.download_count || 0) + 1
      }))
    } catch (err) {
      alert('다운로드 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('이 문서를 삭제하시겠습니까?')) return

    try {
      await api.delete(`/documents/documents/${id}/`)
      navigate('/documents')
    } catch (err) {
      alert('삭제 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다'))
    }
  }

  const isCreator = user?.profile?.id === document?.created_by
  const isManager = user?.profile?.role && ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO'].includes(user.profile.role)
  const canEdit = isManager || isCreator

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
          <p className="font-medium mb-2">오류</p>
          <p>{error}</p>
          <button
            onClick={() => navigate('/documents')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => navigate('/documents')}
          className="mb-6 text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          ← 목록으로 돌아가기
        </button>

        {/* 메인 카드 */}
        <div className="bg-white rounded-lg shadow p-8">
          {/* 헤더 */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{document.title}</h1>
              <div className="flex gap-2">
                <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded">
                  {documentTypeLabels[document.document_type] || document.document_type}
                </span>
                {document.category_data && (
                  <span className="inline-block bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded">
                    {document.category_data.name}
                  </span>
                )}
                {document.is_public && (
                  <span className="inline-block bg-green-100 text-green-800 text-sm px-3 py-1 rounded">
                    🔓 공개
                  </span>
                )}
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              {canEdit && (
                <>
                  <button
                    onClick={() => navigate(`/documents/${id}/edit`)}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition"
                  >
                    수정
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 설명 */}
          {document.description && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700">{document.description}</p>
            </div>
          )}

          {/* 메타데이터 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 pb-8 border-b">
            <div>
              <p className="text-sm text-gray-600">버전</p>
              <p className="text-lg font-semibold text-gray-900">
                {document.version}
                {document.is_latest && <span className="text-xs text-green-600 ml-2">최신</span>}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">파일 크기</p>
              <p className="text-lg font-semibold text-gray-900">
                {document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">다운로드</p>
              <p className="text-lg font-semibold text-gray-900">{document.download_count || 0}회</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">작성자</p>
              <p className="text-lg font-semibold text-gray-900">
                {document.created_by_name || '알 수 없음'}
              </p>
            </div>
          </div>

          {/* 날짜 정보 */}
          <div className="mb-8 space-y-2 text-sm text-gray-600">
            <p>작성: {new Date(document.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} {new Date(document.created_at).toLocaleTimeString('ko-KR')}</p>
            <p>수정: {new Date(document.updated_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} {new Date(document.updated_at).toLocaleTimeString('ko-KR')}</p>
          </div>

          {/* 다운로드 버튼 */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium text-lg"
          >
            {downloading ? '다운로드 중...' : '📥 파일 다운로드'}
          </button>
        </div>

        {/* 버전 이력 */}
        {document.downloads && document.downloads.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">최근 다운로드</h2>
            <div className="space-y-3">
              {document.downloads.slice(0, 10).map((dl, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{dl.downloaded_by_name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(dl.downloaded_at).toLocaleDateString('ko-KR')} {new Date(dl.downloaded_at).toLocaleTimeString('ko-KR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {document.downloads.length > 10 && (
              <button
                onClick={() => navigate(`/documents/${id}/versions`)}
                className="mt-4 w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
              >
                모든 다운로드 이력 보기
              </button>
            )}
          </div>
        )}

        {/* 버전 이력 버튼 */}
        <div className="mt-8">
          <button
            onClick={() => navigate(`/documents/${id}/versions`)}
            className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            📋 버전 이력 보기
          </button>
        </div>
      </div>
    </div>
  )
}

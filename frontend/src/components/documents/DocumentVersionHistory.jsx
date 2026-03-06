import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function DocumentVersionHistory() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [versions, setVersions] = useState([])
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    fetchVersionHistory()
  }, [id])

  const fetchVersionHistory = async () => {
    setLoading(true)
    setError('')
    try {
      // 문서 기본 정보 조회
      const docResponse = await api.get(`/documents/documents/${id}/`)
      setDocument(docResponse.data)

      // 버전 이력 조회
      const versionsResponse = await api.get(`/documents/documents/${id}/versions/`)
      setVersions(versionsResponse.data || [])
    } catch (err) {
      setError(err.response?.data?.detail || '버전 이력 조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadVersion = async (versionId) => {
    setDownloading(versionId)
    try {
      // 다운로드 기록
      await api.post(`/documents/documents/${versionId}/download/`)

      // 파일 다운로드
      const version = versions.find(v => v.id === versionId)
      if (version && version.file) {
        const fileUrl = version.file
        const link = document.createElement('a')
        link.href = fileUrl
        link.target = '_blank'
        link.download = fileUrl.split('/').pop()
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err) {
      alert('다운로드 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
          <p className="font-medium mb-2">오류</p>
          <p>{error}</p>
          <button
            onClick={() => navigate(-1)}
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
          onClick={() => navigate(`/documents/${id}`)}
          className="mb-6 text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          ← 문서 상세로 돌아가기
        </button>

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">버전 이력</h1>
          {document && (
            <p className="text-gray-600 mt-2">{document.title}</p>
          )}
        </div>

        {/* 버전 목록 */}
        {versions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 text-lg">버전 정보가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={`bg-white rounded-lg shadow p-6 ${
                  version.is_latest ? 'ring-2 ring-green-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-bold text-gray-900">
                        v{version.version}
                      </h3>
                      {version.is_latest && (
                        <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded mt-1 w-fit">
                          최신 버전
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownloadVersion(version.id)}
                    disabled={downloading === version.id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
                  >
                    {downloading === version.id ? '다운로드 중...' : '다운로드'}
                  </button>
                </div>

                {/* 메타데이터 */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">작성자</p>
                    <p className="font-medium text-gray-900">
                      {version.created_by_name || '알 수 없음'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">생성 날짜</p>
                    <p className="font-medium text-gray-900">
                      {new Date(version.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">시간</p>
                    <p className="font-medium text-gray-900">
                      {new Date(version.created_at).toLocaleTimeString('ko-KR')}
                    </p>
                  </div>
                </div>

                {/* 버전 설명 (있으면) */}
                {index === 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500">
                      이것이 현재 사용 중인 버전입니다
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 버전 관리 정보 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ 정보:</strong> 새로운 파일을 같은 제목으로 업로드하면 자동으로 새 버전이 생성됩니다. 모든 버전의 파일을 다운로드할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

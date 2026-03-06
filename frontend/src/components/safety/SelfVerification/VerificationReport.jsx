import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../../services/api'

export default function VerificationReport() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [verification, setVerification] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchVerification()
  }, [id])

  const fetchVerification = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/safety/verifications/${id}/`)
      setVerification(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || '검증 보고서를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePDF = async () => {
    setGenerating(true)
    try {
      const response = await api.get(`/safety/verifications/${id}/generate_pdf/`, {
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `verification-report-${id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentElement.removeChild(link)
    } catch (err) {
      setError('PDF 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">보고서 로드 중...</p>
      </div>
    )
  }

  if (!verification) {
    return (
      <div className="space-y-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error || '검증 보고서를 찾을 수 없습니다.'}
        </div>
        <button
          onClick={() => navigate('/safety/verifications/list')}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          목록으로
        </button>
      </div>
    )
  }

  const complianceScore = verification.compliance_score || 0
  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const checklistItems = verification.responses ? Object.keys(verification.responses) : []
  const completedItems = checklistItems.filter(key => verification.responses[key] === true).length

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">검증 보고서</h1>
          <p className="text-gray-600 mt-1">
            {verification.period_start} ~ {verification.period_end}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGeneratePDF}
            disabled={generating}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'PDF 생성 중...' : '📄 PDF 다운로드'}
          </button>
          <button
            onClick={() => navigate('/safety/verifications/list')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            목록으로
          </button>
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 규정 준수 점수 카드 */}
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 점수 원형 */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 rounded-full border-8 border-gray-200 flex items-center justify-center">
              <div className="text-center">
                <p className={`text-4xl font-bold ${getScoreColor(complianceScore)}`}>
                  {complianceScore}
                </p>
                <p className="text-gray-600 text-sm">점수</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              {complianceScore >= 90 && (
                <p className="text-green-700 font-semibold">✓ 우수</p>
              )}
              {complianceScore >= 70 && complianceScore < 90 && (
                <p className="text-yellow-700 font-semibold">⚠ 보통</p>
              )}
              {complianceScore < 70 && (
                <p className="text-red-700 font-semibold">✕ 개선 필요</p>
              )}
            </div>
          </div>

          {/* 통계 */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">검증 주기</p>
              <p className="text-lg font-semibold text-gray-900">
                {verification.frequency === 'weekly' ? '주간' : verification.frequency === 'monthly' ? '월간' : '분기별'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">체크리스트 완료</p>
              <p className="text-lg font-semibold text-gray-900">
                {completedItems} / {checklistItems.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">완료율</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${checklistItems.length > 0 ? (completedItems / checklistItems.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="font-semibold text-gray-900">
                  {checklistItems.length > 0 ? Math.round((completedItems / checklistItems.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* 검증자 정보 */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">검증자</p>
              <p className="text-lg font-semibold text-gray-900">
                {verification.verified_by_name || '미지정'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">검증 완료일</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(verification.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 체크리스트 섹션 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">검증 체크리스트</h3>
        <div className="space-y-2">
          {verification.responses && Object.entries(verification.responses).map(([key, value]) => (
            <div
              key={key}
              className={`p-4 rounded border-l-4 ${
                value
                  ? 'bg-green-50 border-green-500'
                  : 'bg-red-50 border-red-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">
                  {key.replace(/_/g, ' ').toUpperCase()}
                </p>
                <span className={`px-3 py-1 rounded text-sm font-semibold ${
                  value
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {value ? '✓ 완료' : '✕ 미완료'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 발견사항 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">발견사항</h3>
        {verification.findings ? (
          <div className="p-4 bg-gray-50 rounded border-l-4 border-blue-500">
            <p className="text-gray-700 whitespace-pre-wrap">
              {verification.findings}
            </p>
          </div>
        ) : (
          <p className="text-gray-600 italic">특별한 발견사항 없음</p>
        )}
      </div>

      {/* 개선 계획 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">개선 계획</h3>
        {verification.corrective_actions ? (
          <div className="p-4 bg-yellow-50 rounded border-l-4 border-yellow-500">
            <p className="text-gray-700 whitespace-pre-wrap">
              {verification.corrective_actions}
            </p>
          </div>
        ) : (
          <p className="text-gray-600 italic">계획된 개선 조치 없음</p>
        )}
      </div>

      {/* 추가 정보 */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">추가 정보</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">검증 기간</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date(verification.period_start).toLocaleDateString('ko-KR')} ~
              <br />
              {new Date(verification.period_end).toLocaleDateString('ko-KR')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">기록 생성일</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date(verification.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">마지막 수정</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date(verification.updated_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => navigate('/safety/verifications/list')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          목록으로
        </button>
        <button
          onClick={handleGeneratePDF}
          disabled={generating}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'PDF 생성 중...' : '📄 PDF 다운로드'}
        </button>
      </div>
    </div>
  )
}

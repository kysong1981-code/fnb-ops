import React from 'react'
import { useAuth } from '../../context/AuthContext'

const documentTypeIcons = {
  CONTRACT: '📄',
  JOB_DESCRIPTION: '📋',
  JOB_OFFER: '💼',
  POLICY: '📘',
  MANUAL: '📖',
  TRAINING: '🎓',
  SAFETY: '🛡️',
  OTHER: '📎'
}

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

export default function DocumentCard({ document, onView, onDelete }) {
  const { user } = useAuth()
  const isCreator = user?.profile?.id === document.created_by
  const isManager = user?.profile?.role && ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO'].includes(user.profile.role)
  const canDelete = isManager || isCreator

  const icon = documentTypeIcons[document.document_type] || '📎'
  const typeLabel = documentTypeLabels[document.document_type] || document.document_type

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition p-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{icon}</span>
        {canDelete && (
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-600 transition"
            title="삭제"
          >
            ✕
          </button>
        )}
      </div>

      {/* 제목 */}
      <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
        {document.title}
      </h3>

      {/* 설명 */}
      {document.description && (
        <p className="text-gray-600 text-xs mb-3 line-clamp-2">
          {document.description}
        </p>
      )}

      {/* 배지 */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
          {typeLabel}
        </span>
        {document.category_name && (
          <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
            {document.category_name}
          </span>
        )}
        {document.is_latest && (
          <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
            v{document.version}
          </span>
        )}
      </div>

      {/* 메타데이터 */}
      <div className="text-xs text-gray-500 space-y-1 mb-4 border-t pt-2">
        <div>작성자: {document.created_by_name || '알 수 없음'}</div>
        <div>
          {new Date(document.created_at).toLocaleDateString('ko-KR')}
        </div>
        <div className="flex justify-between">
          <span>📥 {document.download_count || 0}회</span>
          {document.is_public && <span>🔓 공개</span>}
        </div>
      </div>

      {/* 버튼 */}
      <button
        onClick={onView}
        className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
      >
        보기 및 다운로드
      </button>
    </div>
  )
}

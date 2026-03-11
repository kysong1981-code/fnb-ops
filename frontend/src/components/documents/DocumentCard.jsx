import React from 'react'
import { useAuth } from '../../context/AuthContext'

const documentTypeLabels = {
  CONTRACT: 'Contract',
  JOB_DESCRIPTION: 'Job Description',
  JOB_OFFER: 'Job Offer',
  POLICY: 'Policy',
  MANUAL: 'Manual',
  TRAINING: 'Training',
  SAFETY: 'Safety',
  OTHER: 'Other'
}

const documentTypeIcons = {
  CONTRACT: '\uD83D\uDCC4',
  JOB_DESCRIPTION: '\uD83D\uDCCB',
  JOB_OFFER: '\uD83D\uDCBC',
  POLICY: '\uD83D\uDCD8',
  MANUAL: '\uD83D\uDCD6',
  TRAINING: '\uD83C\uDF93',
  SAFETY: '\uD83D\uDEE1\uFE0F',
  OTHER: '\uD83D\uDCCE'
}

export default function DocumentCard({ document, onView, onDelete }) {
  const { user } = useAuth()
  const isCreator = user?.id === document.created_by
  const isManager = user?.role && ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO'].includes(user.role)
  const canDelete = isManager || isCreator

  const icon = documentTypeIcons[document.document_type] || '\uD83D\uDCCE'
  const typeLabel = documentTypeLabels[document.document_type] || document.document_type

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-sm transition p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{icon}</span>
        {canDelete && (
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-600 transition"
            title="Delete"
          >
            ✕
          </button>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
        {document.title}
      </h3>

      {/* Description */}
      {document.description && (
        <p className="text-gray-600 text-xs mb-3 line-clamp-2">
          {document.description}
        </p>
      )}

      {/* Badges */}
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

      {/* Metadata */}
      <div className="text-xs text-gray-500 space-y-1 mb-4 border-t pt-2">
        <div>By: {document.created_by_name || 'Unknown'}</div>
        <div>
          {new Date(document.created_at).toLocaleDateString('en-NZ')}
        </div>
        <div className="flex justify-between">
          <span>{document.download_count || 0} downloads</span>
          {document.is_public && <span>Public</span>}
        </div>
      </div>

      {/* Button */}
      <button
        onClick={onView}
        className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
      >
        View & Download
      </button>
    </div>
  )
}

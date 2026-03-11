import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

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

export default function DocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [doc, setDoc] = useState(null)
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
      setDoc(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      // Record download
      await api.post(`/documents/documents/${id}/download/`)

      // Download file
      const fileUrl = doc.file
      const link = window.document.createElement('a')
      link.href = fileUrl
      link.target = '_blank'
      link.download = doc.file.split('/').pop()
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)

      // Update download count
      setDoc(prev => ({
        ...prev,
        download_count: (prev.download_count || 0) + 1
      }))
    } catch (err) {
      alert('Download failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document?')) return

    try {
      await api.delete(`/documents/documents/${id}/`)
      navigate('/documents')
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.detail || 'An error occurred'))
    }
  }

  const isCreator = user?.id === doc?.created_by
  const isManager = user?.role && ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO'].includes(user.role)
  const canEdit = isManager || isCreator

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
          <p className="font-medium mb-2">Error</p>
          <p>{error}</p>
          <button
            onClick={() => navigate('/documents')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/documents')}
          className="mb-6 text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          {'\u2190'} Back to Library
        </button>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{doc.title}</h1>
              <div className="flex gap-2">
                <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded">
                  {documentTypeLabels[doc.document_type] || doc.document_type}
                </span>
                {doc.category_data && (
                  <span className="inline-block bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded">
                    {doc.category_data.name}
                  </span>
                )}
                {doc.is_public && (
                  <span className="inline-block bg-green-100 text-green-800 text-sm px-3 py-1 rounded">
                    Public
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {canEdit && (
                <>
                  <button
                    onClick={() => navigate(`/documents/${id}/edit`)}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {doc.description && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700">{doc.description}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 pb-8 border-b">
            <div>
              <p className="text-sm text-gray-600">Version</p>
              <p className="text-lg font-semibold text-gray-900">
                {doc.version}
                {doc.is_latest && <span className="text-xs text-green-600 ml-2">Latest</span>}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">File Size</p>
              <p className="text-lg font-semibold text-gray-900">
                {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Downloads</p>
              <p className="text-lg font-semibold text-gray-900">{doc.download_count || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Author</p>
              <p className="text-lg font-semibold text-gray-900">
                {doc.created_by_name || 'Unknown'}
              </p>
            </div>
          </div>

          {/* Date Info */}
          <div className="mb-8 space-y-2 text-sm text-gray-600">
            <p>Created: {new Date(doc.created_at).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' })} {new Date(doc.created_at).toLocaleTimeString('en-NZ')}</p>
            <p>Updated: {new Date(doc.updated_at).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' })} {new Date(doc.updated_at).toLocaleTimeString('en-NZ')}</p>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium text-lg"
          >
            {downloading ? 'Downloading...' : 'Download File'}
          </button>
        </div>

        {/* Download History */}
        {doc.downloads && doc.downloads.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Downloads</h2>
            <div className="space-y-3">
              {doc.downloads.slice(0, 10).map((dl, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{dl.downloaded_by_name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(dl.downloaded_at).toLocaleDateString('en-NZ')} {new Date(dl.downloaded_at).toLocaleTimeString('en-NZ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {doc.downloads.length > 10 && (
              <button
                onClick={() => navigate(`/documents/${id}/versions`)}
                className="mt-4 w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
              >
                View All Download History
              </button>
            )}
          </div>
        )}

        {/* Version History Button */}
        <div className="mt-8">
          <button
            onClick={() => navigate(`/documents/${id}/versions`)}
            className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            View Version History
          </button>
        </div>
      </div>
    </div>
  )
}

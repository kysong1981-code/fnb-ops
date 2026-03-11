import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function DocumentVersionHistory() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [versions, setVersions] = useState([])
  const [doc, setDoc] = useState(null)
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
      // Fetch document info
      const docResponse = await api.get(`/documents/documents/${id}/`)
      setDoc(docResponse.data)

      // Fetch version history
      const versionsResponse = await api.get(`/documents/documents/${id}/versions/`)
      const data = versionsResponse.data
      setVersions(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load version history')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadVersion = async (versionId) => {
    setDownloading(versionId)
    try {
      // Record download
      await api.post(`/documents/documents/${versionId}/download/`)

      // Download file
      const version = versions.find(v => v.id === versionId)
      if (version && version.file) {
        const fileUrl = version.file
        const link = window.document.createElement('a')
        link.href = fileUrl
        link.target = '_blank'
        link.download = fileUrl.split('/').pop()
        window.document.body.appendChild(link)
        link.click()
        window.document.body.removeChild(link)
      }
    } catch (err) {
      alert('Download failed: ' + (err.response?.data?.detail || err.message))
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
          <p className="font-medium mb-2">Error</p>
          <p>{error}</p>
          <button
            onClick={() => navigate(-1)}
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
          onClick={() => navigate(`/documents/${id}`)}
          className="mb-6 text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          {'\u2190'} Back to Document
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Version History</h1>
          {doc && (
            <p className="text-gray-600 mt-2">{doc.title}</p>
          )}
        </div>

        {/* Version List */}
        {versions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 text-lg">No version history available</p>
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
                          Latest
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownloadVersion(version.id)}
                    disabled={downloading === version.id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
                  >
                    {downloading === version.id ? 'Downloading...' : 'Download'}
                  </button>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Author</p>
                    <p className="font-medium text-gray-900">
                      {version.created_by_name || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(version.created_at).toLocaleDateString('en-NZ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Time</p>
                    <p className="font-medium text-gray-900">
                      {new Date(version.created_at).toLocaleTimeString('en-NZ')}
                    </p>
                  </div>
                </div>

                {/* Current version note */}
                {index === 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500">
                      This is the currently active version
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info Note */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Info:</strong> Uploading a new file with the same title automatically creates a new version. All versions are available for download.
          </p>
        </div>
      </div>
    </div>
  )
}

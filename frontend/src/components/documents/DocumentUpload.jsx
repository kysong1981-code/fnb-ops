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
    { value: 'CONTRACT', label: 'Contract' },
    { value: 'JOB_DESCRIPTION', label: 'Job Description' },
    { value: 'JOB_OFFER', label: 'Job Offer' },
    { value: 'POLICY', label: 'Policy' },
    { value: 'MANUAL', label: 'Manual' },
    { value: 'TRAINING', label: 'Training' },
    { value: 'SAFETY', label: 'Safety' },
    { value: 'OTHER', label: 'Other' }
  ]

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/documents/categories/')
        const data = response.data
        setCategories(Array.isArray(data) ? data : (data.results || []))
      } catch (err) {
        console.error('Failed to fetch categories:', err)
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
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be 5MB or less')
        return
      }

      const allowedExtensions = ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png']
      const fileExtension = file.name.split('.').pop().toLowerCase()

      if (!allowedExtensions.includes(fileExtension)) {
        setError('Unsupported file type (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG only)')
        return
      }

      setError('')
      setFormData(prev => ({ ...prev, file }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!formData.title.trim()) {
      setError('Please enter a title')
      setLoading(false)
      return
    }

    if (!formData.file) {
      setError('Please select a file')
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
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setSuccess('Document uploaded successfully')
      setTimeout(() => {
        navigate(`/documents/${response.data.id}`)
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed: ' + JSON.stringify(err.response?.data || err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Upload Document</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter document title"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter a description (optional)"
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type *</label>
            <select
              name="document_type"
              value={formData.document_type}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {documentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Select category (optional)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer">
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.txt"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">{'\uD83D\uDCC1'}</div>
                <p className="text-gray-700 font-medium">Click to select a file or drag and drop</p>
                <p className="text-sm text-gray-500 mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (max 5MB)</p>
                {formData.file && (
                  <p className="text-sm text-green-600 mt-2">Selected: {formData.file.name}</p>
                )}
              </label>
            </div>
          </div>

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
              Public document (uncheck to restrict to managers only)
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{error}</div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">{success}</div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
            >
              {loading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/documents')}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

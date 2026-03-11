import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DocumentList from './DocumentList'

export default function DocumentLibrary() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('all')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const isManager = user?.role && ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO'].includes(user.role)

  const tabs = [
    { id: 'all', label: 'All', documentType: null },
    { id: 'onboarding', label: 'Onboarding', documentType: 'ONBOARDING' },
    { id: 'safety', label: 'Food Safety', documentType: 'SAFETY' },
    { id: 'policy', label: 'Policy', documentType: 'POLICY' },
    { id: 'hr', label: 'HR', documentType: 'HR' },
    { id: 'other', label: 'Other', documentType: 'OTHER' },
  ]

  const currentTab = tabs.find(t => t.id === activeTab)
  const filterDocumentType = currentTab?.documentType

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
  }

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Document Library</h1>
            <p className="text-gray-600 mt-2">Find and download all the documents you need in one place</p>
          </div>
          {isManager && (
            <button
              onClick={() => navigate('/documents/upload')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + Upload Document
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 font-medium whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Document List */}
        <DocumentList
          documentType={filterDocumentType}
          refreshTrigger={refreshTrigger}
        />
      </div>
    </div>
  )
}

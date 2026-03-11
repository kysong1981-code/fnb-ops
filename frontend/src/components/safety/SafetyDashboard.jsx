import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Card from '../ui/Card'
import PageHeader from '../ui/PageHeader'
import KpiCard from '../ui/KpiCard'
import SectionLabel from '../ui/SectionLabel'
import { ShieldIcon, ClipboardIcon, WarningIcon, CheckCircleIcon, ArrowRightIcon } from '../icons'

export default function SafetyDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [todaySummary, setTodaySummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSafetySummary()
  }, [])

  const fetchSafetySummary = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/safety/dashboard/today_summary/')
      setTodaySummary(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load safety summary.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 mt-4">Loading safety dashboard...</p>
      </div>
    )
  }

  const tabs = [
    { key: 'checklist', label: 'Checklists' },
    { key: 'temperature', label: 'Temperature' },
    { key: 'cleaning', label: 'Cleaning' },
    { key: 'training', label: 'Training' },
    { key: 'incidents', label: 'Incidents' },
  ]

  const tabContent = {
    checklist: {
      title: 'Daily Safety Checklist',
      desc: 'Complete daily checklists for Starting and Closing stages.',
      path: '/safety/checklists',
      btnLabel: 'Manage Checklists',
    },
    temperature: {
      title: 'Temperature Management',
      desc: 'Record and monitor fridge, freezer, and cooking temperatures.',
      path: '/safety/temperatures',
      btnLabel: 'Manage Temperature Records',
    },
    cleaning: {
      title: 'Cleaning Records',
      desc: 'Record daily cleaning schedules and completion status.',
      path: '/safety/cleaning',
      btnLabel: 'Manage Cleaning Records',
    },
    training: {
      title: 'Staff Training Management',
      desc: 'Track staff safety training completion and upcoming expiry dates.',
      path: '/safety/training',
      btnLabel: 'Manage Training',
    },
    incidents: {
      title: 'Incident Records',
      desc: 'Record and resolve food safety incidents, complaints, and issues.',
      path: '/safety/incidents',
      btnLabel: 'Manage Incident Records',
    },
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <PageHeader
        icon={ShieldIcon}
        title="Food Safety Management"
        subtitle="New Zealand FCP (Food Control Plan) Compliance"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Today's Summary */}
      {todaySummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Checklists" value={`${todaySummary.completion_rate}%`} sub={`${todaySummary.completed_checklists} / ${todaySummary.total_checklists}`} />
          <KpiCard label="Temp Alerts" value={todaySummary.temperature_alerts} alert={todaySummary.temperature_alerts > 0 ? 'Abnormal' : null} />
          <KpiCard label="Open Incidents" value={todaySummary.open_incidents} alert={todaySummary.open_incidents > 0 ? 'Pending' : null} />
          <KpiCard
            label="Overall Status"
            value={todaySummary.completion_rate >= 80 && todaySummary.open_incidents === 0 ? 'Normal' : 'Caution'}
          />
        </div>
      )}

      {/* Tab Navigation */}
      <Card>
        <div className="border-b border-gray-100">
          <div className="flex overflow-x-auto px-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {(() => {
            const content = tabContent[activeTab]
            if (!content) return null
            return (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{content.title}</h3>
                <p className="text-gray-500 text-sm mb-4">{content.desc}</p>
                <button
                  onClick={() => navigate(content.path)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
                >
                  {content.btnLabel}
                  <ArrowRightIcon size={14} />
                </button>
              </div>
            )
          })()}
        </div>
      </Card>

      {/* Quick Actions */}
      <SectionLabel>Quick Actions</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/safety/checklists')}
          className="text-left"
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <ClipboardIcon size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Create Checklist</p>
                <p className="text-xs text-gray-400">Complete today's checklist</p>
              </div>
            </div>
          </Card>
        </button>

        <button
          onClick={() => navigate('/safety/temperatures')}
          className="text-left"
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <WarningIcon size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Record Temperature</p>
                <p className="text-xs text-gray-400">Enter temperature reading</p>
              </div>
            </div>
          </Card>
        </button>

        <button
          onClick={() => navigate('/safety/cleaning')}
          className="text-left"
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircleIcon size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Cleaning Complete</p>
                <p className="text-xs text-gray-400">Enter cleaning record</p>
              </div>
            </div>
          </Card>
        </button>

        <button
          onClick={() => navigate('/safety/incidents')}
          className="text-left"
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <ShieldIcon size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Report Incident</p>
                <p className="text-xs text-gray-400">Report safety incident</p>
              </div>
            </div>
          </Card>
        </button>
      </div>
    </div>
  )
}

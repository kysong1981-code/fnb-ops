import { useState } from 'react'
import TeamTab from './TeamTab'
import InviteTab from './InviteTab'
import OnboardingTab from './OnboardingTab'
import { TeamIcon } from '../icons'
import PageHeader from '../ui/PageHeader'

const TABS = [
  { key: 'team', label: 'Team' },
  { key: 'invite', label: 'Invite' },
  { key: 'onboarding', label: 'Onboarding' },
]

export default function HRHub() {
  const [activeTab, setActiveTab] = useState('team')

  return (
    <div className="space-y-5">
      <PageHeader
        title="HR Management"
        subtitle="Team, invitations, and onboarding"
        icon={<TeamIcon size={24} />}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition ${
              activeTab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'invite' && <InviteTab />}
      {activeTab === 'onboarding' && <OnboardingTab />}
    </div>
  )
}

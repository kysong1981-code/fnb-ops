import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import { CheckCircleIcon } from '../icons'

export default function MyTasks() {
  return (
    <div className="px-4 py-6 space-y-6">
      <PageHeader
        icon={CheckCircleIcon}
        title="My Tasks"
        subtitle="Tasks assigned to you"
      />
      <Card className="p-6">
        <p className="text-gray-500 text-sm">Coming soon...</p>
      </Card>
    </div>
  )
}

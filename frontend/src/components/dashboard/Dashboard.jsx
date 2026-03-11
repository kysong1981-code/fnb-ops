import { useAuth } from '../../context/AuthContext'
import EmployeeDashboard from './EmployeeDashboard'
import ManagerDashboard from './ManagerDashboard'
import RegionalDashboard from './RegionalDashboard'

export default function Dashboard() {
  const { user } = useAuth()

  const renderDashboard = () => {
    if (!user) return null

    switch (user.role) {
      case 'EMPLOYEE':
        return <EmployeeDashboard />
      case 'MANAGER':
      case 'SENIOR_MANAGER':
        return <ManagerDashboard />
      case 'REGIONAL_MANAGER':
      case 'HQ':
      case 'CEO':
        return <RegionalDashboard />
      case 'ADMIN':
        return <ManagerDashboard />
      default:
        return <EmployeeDashboard />
    }
  }

  return (
    <div className="w-full">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderDashboard()}
      </main>
    </div>
  )
}

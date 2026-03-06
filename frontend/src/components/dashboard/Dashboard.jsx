import { useAuth } from '../../context/AuthContext'
import Header from './Header'
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
      default:
        return <EmployeeDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderDashboard()}
      </main>
    </div>
  )
}

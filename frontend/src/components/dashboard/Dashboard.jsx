import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import EmployeeDashboard from './EmployeeDashboard'
import ManagerDashboard from './ManagerDashboard'
import RegionalDashboard from './RegionalDashboard'

export default function Dashboard() {
  const { user } = useAuth()
  const { isAllStores } = useStore()

  const renderDashboard = () => {
    if (!user) return null

    // When "All Stores" is selected, always show RegionalDashboard
    if (isAllStores) {
      return <RegionalDashboard />
    }

    switch (user.role) {
      case 'EMPLOYEE':
        return <EmployeeDashboard />
      case 'MANAGER':
      case 'SENIOR_MANAGER':
        return <ManagerDashboard />
      case 'REGIONAL_MANAGER':
      case 'HQ':
      case 'CEO':
        return <ManagerDashboard />
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

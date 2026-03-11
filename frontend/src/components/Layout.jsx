import { useAuth } from '../context/AuthContext'
import ManagerSidebar from './navigation/ManagerSidebar'
import ManagerHeader from './navigation/ManagerHeader'
import EmployeeHeader from './navigation/EmployeeHeader'
import EmployeeBottomNav from './navigation/EmployeeBottomNav'

const MANAGER_ROLES = ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO', 'ADMIN']

export default function Layout({ children }) {
  const { user } = useAuth()
  const isManager = user && MANAGER_ROLES.includes(user.role)

  if (isManager) {
    return (
      <div className="flex h-screen bg-gray-50">
        <ManagerSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ManagerHeader />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <EmployeeHeader />
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <EmployeeBottomNav />
    </div>
  )
}

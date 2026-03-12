import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const MANAGER_ROLES = ['CEO', 'HQ', 'ADMIN', 'REGIONAL_MANAGER', 'SENIOR_MANAGER', 'MANAGER']

export default function ManagerRoute({ children }) {
  const { user } = useAuth()

  if (!MANAGER_ROLES.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

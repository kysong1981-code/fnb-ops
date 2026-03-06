import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getRoleDisplay = (role) => {
    const roles = {
      EMPLOYEE: '직원',
      MANAGER: '매니저',
      SENIOR_MANAGER: '시니어 매니저',
      REGIONAL_MANAGER: '지역 매니저',
      HQ: '본사',
      CEO: 'CEO',
    }
    return roles[role] || role
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        {/* 좌측: 로고/제목 */}
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-indigo-600">FNB Ops</h1>
        </div>

        {/* 우측: 사용자 정보 및 로그아웃 */}
        <div className="flex items-center gap-6">
          {user && (
            <>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {user.user_first_name} {user.user_last_name}
                </p>
                <p className="text-xs text-gray-600">
                  {getRoleDisplay(user.role)}
                </p>
              </div>

              <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                {user.user_first_name?.charAt(0)}
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

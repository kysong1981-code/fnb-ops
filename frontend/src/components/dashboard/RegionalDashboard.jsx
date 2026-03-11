import { useAuth } from '../../context/AuthContext'

export default function RegionalDashboard() {
  const { user } = useAuth()

  const getRoleDisplay = (role) => {
    const roles = {
      REGIONAL_MANAGER: 'Regional Manager',
      HQ: 'Head Office',
      CEO: 'CEO',
    }
    return roles[role] || role
  }

  return (
    <div className="space-y-6">
      {/* 환영 메시지 */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">
          Welcome, {getRoleDisplay(user?.role)} {user?.user_first_name}!
        </h2>
        <p className="text-gray-500">Monitor all stores and company-wide performance</p>
      </div>

      {/* 전체 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 전체 매장 */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <p className="text-sm text-gray-600 mb-2">Total Stores</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">Coming soon</p>
        </div>

        {/* 전체 직원 */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600 mb-2">Total Staff</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">Coming soon</p>
        </div>

        {/* 전사 매출 */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-600 mb-2">Total Sales</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">Coming soon</p>
        </div>

        {/* 완료율 */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600 mb-2">Closing Rate</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">Coming soon</p>
        </div>
      </div>

      {/* 상세 리포트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 매장 리스트 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Store Status</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-700 font-semibold">
                    Store Name
                  </th>
                  <th className="text-left py-2 text-gray-700 font-semibold">
                    Closing
                  </th>
                  <th className="text-right py-2 text-gray-700 font-semibold">
                    Sales
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 text-center py-4">
                  <td colSpan="3" className="py-8 text-gray-500">
                    Data coming soon
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 성과 지표 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Key Performance Metrics
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  Avg Sales per Hour
                </span>
                <span className="text-sm font-semibold text-gray-900">-</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full" style={{width: '0%'}}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  Closing Completion
                </span>
                <span className="text-sm font-semibold text-gray-900">-</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{width: '0%'}}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  Food Safety Completion
                </span>
                <span className="text-sm font-semibold text-gray-900">-</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{width: '0%'}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

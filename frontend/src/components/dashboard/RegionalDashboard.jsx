import { useAuth } from '../../context/AuthContext'

export default function RegionalDashboard() {
  const { user } = useAuth()

  const getRoleDisplay = (role) => {
    const roles = {
      REGIONAL_MANAGER: '지역 매니저',
      HQ: '본사',
      CEO: 'CEO',
    }
    return roles[role] || role
  }

  return (
    <div className="space-y-6">
      {/* 환영 메시지 */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-md p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          {user?.user_first_name} {user?.user_last_name} {getRoleDisplay(user?.role)}님
        </h2>
        <p className="text-purple-100">전사 현황을 모니터링하세요</p>
      </div>

      {/* 전체 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 전체 매장 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <p className="text-sm text-gray-600 mb-2">전체 매장</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">준비 중</p>
        </div>

        {/* 전체 직원 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600 mb-2">전체 직원</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">준비 중</p>
        </div>

        {/* 전사 매출 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-600 mb-2">전사 매출</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">준비 중</p>
        </div>

        {/* 완료율 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600 mb-2">클로징 완료율</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">준비 중</p>
        </div>
      </div>

      {/* 상세 리포트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 매장 리스트 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">매장 현황</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-700 font-semibold">
                    매장명
                  </th>
                  <th className="text-left py-2 text-gray-700 font-semibold">
                    클로징
                  </th>
                  <th className="text-right py-2 text-gray-700 font-semibold">
                    매출
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 text-center py-4">
                  <td colSpan="3" className="py-8 text-gray-500">
                    데이터 준비 중
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 성과 지표 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            주요 성과 지표
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  평균 시간당 매출
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
                  클로징 완료율
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
                  FCP 완료율
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

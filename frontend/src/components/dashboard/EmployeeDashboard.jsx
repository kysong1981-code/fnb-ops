import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      {/* 환영 메시지 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          환영합니다, {user?.user_first_name}님!
        </h2>
        <p className="text-gray-600">오늘의 업무를 시작하세요</p>
      </div>

      {/* 기본 정보 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 내 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">내 정보</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600">사원번호</p>
              <p className="font-semibold text-gray-900">{user?.employee_id}</p>
            </div>
            <div>
              <p className="text-gray-600">이메일</p>
              <p className="font-semibold text-gray-900">{user?.user_email}</p>
            </div>
            <div>
              <p className="text-gray-600">입사일</p>
              <p className="font-semibold text-gray-900">
                {user?.date_of_joining}
              </p>
            </div>
          </div>
        </div>

        {/* 로스터 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">근무 일정</h3>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">이번주</p>
              <p className="text-lg font-bold text-blue-600">준비 중</p>
            </div>
          </div>
        </div>

        {/* 급여명세서 */}
        <div
          onClick={() => navigate('/payroll')}
          className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500 cursor-pointer hover:shadow-lg transition"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">급여명세서</h3>
          <div className="space-y-3">
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">NZ법 준수</p>
              <p className="text-lg font-bold text-green-600">📄</p>
              <p className="text-xs text-green-700 mt-1">보기</p>
            </div>
          </div>
        </div>

        {/* 할일 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">할일</h3>
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">오늘</p>
              <p className="text-lg font-bold text-yellow-600">준비 중</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

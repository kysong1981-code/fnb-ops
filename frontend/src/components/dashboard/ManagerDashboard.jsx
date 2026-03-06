import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      {/* 환영 메시지 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-md p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          {user?.user_first_name} {user?.user_last_name} 매니저님
        </h2>
        <p className="text-blue-100">매장 운영 현황을 확인하세요</p>
      </div>

      {/* 매니저용 주요 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 클로징 상태 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
          <p className="text-sm text-gray-600 mb-2">오늘 클로징</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">준비 중</p>
        </div>

        {/* 직원 현황 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-600 mb-2">직원 수</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">준비 중</p>
        </div>

        {/* 매출 분석 */}
        <div
          onClick={() => navigate('/sales')}
          className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500 cursor-pointer hover:shadow-lg transition"
        >
          <p className="text-sm text-gray-600 mb-2">매출 분석</p>
          <p className="text-3xl font-bold text-gray-900">📊</p>
          <p className="text-xs text-gray-500 mt-2">분석 보기</p>
        </div>

        {/* 매장 리포트 */}
        <div
          onClick={() => navigate('/reports')}
          className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500 cursor-pointer hover:shadow-lg transition"
        >
          <p className="text-sm text-gray-600 mb-2">매장 리포트</p>
          <p className="text-3xl font-bold text-gray-900">📈</p>
          <p className="text-xs text-gray-500 mt-2">리포트 보기</p>
        </div>

        {/* HR/온보딩 */}
        <div
          onClick={() => navigate('/hr')}
          className="bg-white rounded-lg shadow-md p-6 border-l-4 border-pink-500 cursor-pointer hover:shadow-lg transition"
        >
          <p className="text-sm text-gray-600 mb-2">HR 관리</p>
          <p className="text-3xl font-bold text-gray-900">👤</p>
          <p className="text-xs text-gray-500 mt-2">온보딩 보기</p>
        </div>

        {/* 할일 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
          <p className="text-sm text-gray-600 mb-2">할일</p>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">준비 중</p>
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 클로징 상세 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            클로징 현황
          </h3>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">클로징 대기</span>
              <span className="font-semibold text-gray-900">0</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">제출됨</span>
              <span className="font-semibold text-gray-900">0</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">승인됨</span>
              <span className="font-semibold text-gray-900">0</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate('/closing/form')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
            >
              새 클로징
            </button>
            <button
              onClick={() => navigate('/closing')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium transition"
            >
              현황 보기
            </button>
          </div>
        </div>

        {/* 매장 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            매장 정보
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600">매장명</p>
              <p className="font-semibold text-gray-900">
                {user?.organization_detail?.name || '미설정'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">주소</p>
              <p className="font-semibold text-gray-900">
                {user?.organization_detail?.address || '미설정'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">연락처</p>
              <p className="font-semibold text-gray-900">
                {user?.organization_detail?.phone || '미설정'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

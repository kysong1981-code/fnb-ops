import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function SafetyDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [todaySummary, setTodaySummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSafetySummary()
  }, [])

  const fetchSafetySummary = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/safety/dashboard/today_summary/')
      setTodaySummary(response.data)
    } catch (err) {
      setError(err.response?.data?.error || '안전 요약을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">안전 대시보드 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">음식 안전 관리</h1>
        <p className="text-gray-600 mt-1">뉴질랜드 FCP (Food Control Plan) 준수</p>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 오늘의 요약 카드들 */}
      {todaySummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 체크리스트 완료율 */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">체크리스트</h3>
            <div className="text-3xl font-bold text-blue-600">{todaySummary.completion_rate}%</div>
            <p className="text-sm text-gray-600 mt-2">
              {todaySummary.completed_checklists} / {todaySummary.total_checklists}
            </p>
          </div>

          {/* 온도 경고 */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">온도 경고</h3>
            <div className="text-3xl font-bold text-orange-600">{todaySummary.temperature_alerts}</div>
            <p className="text-sm text-gray-600 mt-2">비정상 온도 기록</p>
          </div>

          {/* 미해결 사건 */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">미해결 사건</h3>
            <div className="text-3xl font-bold text-red-600">{todaySummary.open_incidents}</div>
            <p className="text-sm text-gray-600 mt-2">해결 대기 중</p>
          </div>

          {/* 전체 상태 */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">전체 상태</h3>
            <div className="text-2xl font-bold text-green-600">
              {todaySummary.completion_rate >= 80 && todaySummary.open_incidents === 0 ? '정상' : '주의'}
            </div>
            <p className="text-sm text-gray-600 mt-2">시스템 상태</p>
          </div>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('checklist')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'checklist'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 일일 체크리스트
            </button>
            <button
              onClick={() => setActiveTab('temperature')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'temperature'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🌡️ 온도 관리
            </button>
            <button
              onClick={() => setActiveTab('cleaning')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'cleaning'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🧹 청소 기록
            </button>
            <button
              onClick={() => setActiveTab('training')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'training'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👨‍🎓 교육 관리
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'incidents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ⚠️ 사건 기록
            </button>
          </div>
        </div>

        {/* 탭 내용 */}
        <div className="p-6">
          {activeTab === 'checklist' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">일일 안전 체크리스트</h3>
              <p className="text-gray-600 mb-4">시작(Starting)과 종료(Closing) 단계별 일일 체크리스트를 작성합니다.</p>
              <button
                onClick={() => navigate('/safety/checklists')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                체크리스트 관리
              </button>
            </div>
          )}

          {activeTab === 'temperature' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">온도 관리</h3>
              <p className="text-gray-600 mb-4">냉장고, 냉동고, 조리 온도 등을 기록하고 모니터링합니다.</p>
              <button
                onClick={() => navigate('/safety/temperatures')}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                온도 기록 관리
              </button>
            </div>
          )}

          {activeTab === 'cleaning' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">청소 기록</h3>
              <p className="text-gray-600 mb-4">일일 청소 일정 및 완료 현황을 기록합니다.</p>
              <button
                onClick={() => navigate('/safety/cleaning')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                청소 기록 관리
              </button>
            </div>
          )}

          {activeTab === 'training' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">직원 교육 관리</h3>
              <p className="text-gray-600 mb-4">직원 안전 교육 이수 현황과 만료 예정을 추적합니다.</p>
              <button
                onClick={() => navigate('/safety/training')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                교육 관리
              </button>
            </div>
          )}

          {activeTab === 'incidents' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">사건 기록</h3>
              <p className="text-gray-600 mb-4">음식 안전 관련 사건, 불만 및 문제를 기록하고 해결합니다.</p>
              <button
                onClick={() => navigate('/safety/incidents')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                사건 기록 관리
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 퀵 액션 링크 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">빠른 액션</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/safety/checklists')}
            className="p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
          >
            <div className="text-2xl mb-2">📋</div>
            <p className="font-semibold text-gray-900">체크리스트 작성</p>
            <p className="text-sm text-gray-600">오늘의 체크리스트 작성</p>
          </button>

          <button
            onClick={() => navigate('/safety/temperatures')}
            className="p-4 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition"
          >
            <div className="text-2xl mb-2">🌡️</div>
            <p className="font-semibold text-gray-900">온도 기록</p>
            <p className="text-sm text-gray-600">온도 입력하기</p>
          </button>

          <button
            onClick={() => navigate('/safety/cleaning')}
            className="p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition"
          >
            <div className="text-2xl mb-2">🧹</div>
            <p className="font-semibold text-gray-900">청소 완료</p>
            <p className="text-sm text-gray-600">청소 기록 입력</p>
          </button>

          <button
            onClick={() => navigate('/safety/incidents')}
            className="p-4 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition"
          >
            <div className="text-2xl mb-2">⚠️</div>
            <p className="font-semibold text-gray-900">사건 보고</p>
            <p className="text-sm text-gray-600">안전 사건 보고</p>
          </button>
        </div>
      </div>
    </div>
  )
}

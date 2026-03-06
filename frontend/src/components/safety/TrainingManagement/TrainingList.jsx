import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function TrainingList() {
  const navigate = useNavigate()
  const [trainings, setTrainings] = useState([])
  const [upcomingExpiry, setUpcomingExpiry] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    fetchTrainings()
    fetchUpcomingExpiry()
  }, [])

  const fetchTrainings = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/safety/training/')
      setTrainings(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || '교육을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const fetchUpcomingExpiry = async () => {
    try {
      const response = await api.get('/safety/training/upcoming_expiry/')
      setUpcomingExpiry(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      // 오류 무시
    }
  }

  if (loading && trainings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">교육 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">교육 관리</h1>
          <p className="text-gray-600 mt-1">직원 안전 교육 이수 현황을 추적합니다.</p>
        </div>
        <button
          onClick={() => navigate('/safety/training/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + 새 교육 등록
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 만료 예정 경고 */}
      {upcomingExpiry.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ 30일 내 만료 예정</h3>
          <div className="space-y-2">
            {upcomingExpiry.map(training => (
              <p key={training.id} className="text-sm text-yellow-800">
                <span className="font-semibold">{training.title}</span> - {training.days_until_expiry}일 후 만료
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-4 px-6 font-medium text-sm transition ${
              activeTab === 'all'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            모든 교육 ({trainings.length})
          </button>
          <button
            onClick={() => setActiveTab('expiring')}
            className={`flex-1 py-4 px-6 font-medium text-sm transition ${
              activeTab === 'expiring'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            만료 예정 ({upcomingExpiry.length})
          </button>
        </div>

        {/* 교육 목록 */}
        <div className="divide-y">
          {activeTab === 'all' && trainings.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-gray-600">등록된 교육이 없습니다.</p>
            </div>
          )}

          {activeTab === 'all' && trainings.map(training => (
            <div key={training.id} className="p-6 hover:bg-gray-50 transition">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{training.title}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(training.date).toLocaleDateString('ko-KR')}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">참여 인원</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {training.participants_count || 0}명
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">유효 기간</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {training.validity_months || 12}개월
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">만료 예정</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {training.days_until_expiry && training.days_until_expiry > 0
                      ? `${training.days_until_expiry}일`
                      : '만료됨'}
                  </p>
                </div>

                <div className="text-right">
                  <button
                    onClick={() => navigate(`/safety/training/${training.id}`)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
                  >
                    상세
                  </button>
                </div>
              </div>
            </div>
          ))}

          {activeTab === 'expiring' && upcomingExpiry.map(training => (
            <div key={training.id} className="p-6 bg-yellow-50 hover:bg-yellow-100 transition border-l-4 border-yellow-500">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{training.title}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(training.date).toLocaleDateString('ko-KR')}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">참여 인원</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {training.completion_rate || 0}명
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">만료일</p>
                  <p className="text-lg font-semibold text-yellow-900">
                    {new Date(training.expiry_date).toLocaleDateString('ko-KR')}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">남은 기간</p>
                  <p className="text-lg font-bold text-yellow-600">
                    {training.days_until_expiry}일
                  </p>
                </div>

                <div className="text-right">
                  <button
                    onClick={() => navigate('/safety/training/new')}
                    className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm font-medium"
                  >
                    재교육
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && trainings.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

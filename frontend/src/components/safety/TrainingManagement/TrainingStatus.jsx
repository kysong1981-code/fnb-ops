import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'

export default function TrainingStatus() {
  const navigate = useNavigate()
  const [statusData, setStatusData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedTraining, setSelectedTraining] = useState('')
  const [trainings, setTrainings] = useState([])

  useEffect(() => {
    fetchTrainings()
    fetchStatus()
  }, [selectedTraining])

  const fetchTrainings = async () => {
    try {
      const response = await api.get('/safety/training/')
      setTrainings(Array.isArray(response.data) ? response.data : response.data.results || [])
    } catch (err) {
      console.error('교육 목록 로드 실패:', err)
    }
  }

  const fetchStatus = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (selectedTraining) params.training_id = selectedTraining

      const response = await api.get('/safety/training/staff_status/', { params })
      const data = Array.isArray(response.data) ? response.data : response.data.results || []
      setStatusData(data)
    } catch (err) {
      setError(err.response?.data?.detail || '교육 현황을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getCompletionPercentage = () => {
    if (statusData.length === 0) return 0
    const completed = statusData.filter(s => s.is_completed).length
    return Math.round((completed / statusData.length) * 100)
  }

  const getPendingCount = () => {
    return statusData.filter(s => !s.is_completed).length
  }

  const getExpiringCount = () => {
    return statusData.filter(s => {
      if (!s.expiry_date) return false
      const daysUntilExpiry = Math.ceil((new Date(s.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30
    }).length
  }

  const getExpiredCount = () => {
    return statusData.filter(s => {
      if (!s.expiry_date) return false
      const daysUntilExpiry = Math.ceil((new Date(s.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      return daysUntilExpiry <= 0
    }).length
  }

  const getStatusBadge = (staff) => {
    if (!staff.is_completed) {
      return <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded">미이수</span>
    }

    if (staff.expiry_date) {
      const daysUntilExpiry = Math.ceil((new Date(staff.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      if (daysUntilExpiry <= 0) {
        return <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded">만료됨</span>
      }
      if (daysUntilExpiry <= 30) {
        return <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">{daysUntilExpiry}일 남음</span>
      }
    }

    return <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✓ 이수</span>
  }

  if (loading && statusData.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">교육 현황 로드 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">직원 교육 현황</h1>
          <p className="text-gray-600 mt-1">직원별 필수 안전 교육 이수 현황을 추적합니다.</p>
        </div>
        <button
          onClick={() => navigate('/safety/training/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + 교육 등록
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 교육 선택 및 통계 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">교육 선택</label>
          <select
            value={selectedTraining}
            onChange={(e) => setSelectedTraining(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 교육</option>
            {trainings.map(t => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">전체 직원</p>
            <p className="text-2xl font-bold text-blue-900 mt-2">{statusData.length}</p>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">이수 완료</p>
            <p className="text-2xl font-bold text-green-900 mt-2">{statusData.filter(s => s.is_completed).length}</p>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-600 font-medium">미이수</p>
            <p className="text-2xl font-bold text-red-900 mt-2">{getPendingCount()}</p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-yellow-600 font-medium">만료 예정</p>
            <p className="text-2xl font-bold text-yellow-900 mt-2">{getExpiringCount()}</p>
          </div>
        </div>

        {/* 완료율 진행바 */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">전체 이수율</span>
            <span className="text-2xl font-bold text-blue-600">{getCompletionPercentage()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-blue-600 transition-all"
              style={{ width: `${getCompletionPercentage()}%` }}
            />
          </div>
        </div>
      </div>

      {/* 직원별 현황 테이블 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">직원명</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">직급</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">교육명</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">이수일</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">만료일</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {statusData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <p className="text-gray-600">표시할 교육 현황이 없습니다.</p>
                  </td>
                </tr>
              ) : (
                statusData.map(staff => (
                  <tr key={staff.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{staff.staff_name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {staff.staff_position || '미지정'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {staff.training_title || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {staff.completion_date
                        ? new Date(staff.completion_date).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {staff.expiry_date ? (
                        <span className={staff.expiry_date && Math.ceil((new Date(staff.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) <= 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {new Date(staff.expiry_date).toLocaleDateString('ko-KR')}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(staff)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && statusData.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

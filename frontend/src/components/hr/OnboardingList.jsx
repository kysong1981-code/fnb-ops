import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function OnboardingList() {
  const navigate = useNavigate();
  const [onboardings, setOnboardings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('IN_PROGRESS');

  useEffect(() => {
    fetchOnboardings();
  }, [statusFilter]);

  const fetchOnboardings = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/hr/onboardings/', {
        params: {
          status: statusFilter === 'ALL' ? '' : statusFilter,
        },
      });
      setOnboardings(response.data.results || response.data);
    } catch (err) {
      setError(err.response?.data?.error || '온보딩 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-800', label: '진행 중' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: '완료' },
      ON_HOLD: { bg: 'bg-gray-100', text: 'text-gray-800', label: '보류' },
    };
    const badge = badges[status] || badges.IN_PROGRESS;
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">온보딩 관리</h1>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 상태 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-2 flex-wrap">
          {['IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'ALL'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'IN_PROGRESS'
                ? '진행 중'
                : status === 'COMPLETED'
                ? '완료'
                : status === 'ON_HOLD'
                ? '보류'
                : '전체'}
            </button>
          ))}
        </div>
      </div>

      {/* 온보딩 목록 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">온보딩 목록 로드 중...</p>
        </div>
      ) : onboardings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">온보딩 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    직원명
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    상태
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    진행률
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    작업 / 완료
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    시작일
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {onboardings.map((onboarding) => (
                  <tr key={onboarding.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{onboarding.employee_name}</p>
                      <p className="text-xs text-gray-500">{onboarding.employee_id}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(onboarding.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${getProgressColor(onboarding.completed_percentage)}`}
                            style={{ width: `${onboarding.completed_percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-8">
                          {onboarding.completed_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">
                        {onboarding.completed_tasks} / {onboarding.task_count}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-600">
                        {new Date(onboarding.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/hr/${onboarding.id}`)}
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        상세보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function ClosingList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL'); // ALL, DRAFT, APPROVED, REJECTED

  useEffect(() => {
    fetchClosings();
  }, [filter]);

  const fetchClosings = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/closing/closings/');
      let data = response.data.results || response.data;

      // 필터링
      if (filter !== 'ALL') {
        data = data.filter((c) => c.status === filter);
      }

      setClosings(data);
    } catch (err) {
      setError(err.response?.data?.detail || '클로징 목록 로드에 실패했습니다.');
      setClosings([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getVarianceColor = (variance) => {
    if (variance === 0) return 'text-green-600 font-semibold';
    if (variance > 0) return 'text-blue-600';
    return 'text-red-600 font-semibold';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">클로징 현황</h1>
        <button
          onClick={() => navigate('/closing/form')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          새 클로징 생성
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* 필터 탭 */}
      <div className="mb-6 flex gap-2">
        {['ALL', 'DRAFT', 'APPROVED', 'REJECTED'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status === 'ALL' ? '전체' : status === 'DRAFT' ? '작성 중' : status === 'APPROVED' ? '승인됨' : '거부됨'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">로드 중...</p>
        </div>
      ) : closings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg">클로징 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  폐점 날짜
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  POS 합계
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  실제 합계
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  차이
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  작성자
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  작업
                </th>
              </tr>
            </thead>

            <tbody>
              {closings.map((closing, idx) => (
                <tr
                  key={closing.id}
                  className={`border-t border-gray-200 hover:bg-gray-50 transition ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    #{closing.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(closing.closing_date).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right">
                    {parseInt(closing.pos_total).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right">
                    {parseInt(closing.actual_total).toLocaleString()}
                  </td>
                  <td className={`px-6 py-4 text-sm text-right ${getVarianceColor(closing.total_variance)}`}>
                    {parseInt(closing.total_variance).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(closing.status)}`}>
                      {closing.status === 'DRAFT' ? '작성 중' : closing.status === 'APPROVED' ? '승인됨' : '거부됨'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {closing.created_by_name || '-'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => navigate(`/closing/${closing.id}`)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      상세 보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

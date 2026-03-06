import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function OnboardingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('tasks');

  useEffect(() => {
    fetchOnboarding();
  }, [id]);

  const fetchOnboarding = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/hr/onboardings/${id}/`);
      setOnboarding(response.data);
    } catch (err) {
      setError(err.response?.data?.error || '온보딩 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskComplete = async (taskId, isCompleted) => {
    try {
      const endpoint = isCompleted ? 'incomplete' : 'complete';
      await api.post(`/hr/tasks/${taskId}/${endpoint}/`);
      fetchOnboarding();
    } catch (err) {
      setError(err.response?.data?.error || '작업 상태 변경에 실패했습니다.');
    }
  };

  const signDocument = async (docId) => {
    try {
      await api.post(`/hr/documents/${docId}/sign/`);
      fetchOnboarding();
    } catch (err) {
      setError(err.response?.data?.error || '문서 서명에 실패했습니다.');
    }
  };

  const completeOnboarding = async () => {
    try {
      await api.post(`/hr/onboardings/${id}/complete/`);
      fetchOnboarding();
    } catch (err) {
      setError(err.response?.data?.error || '온보딩 완료에 실패했습니다.');
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

  const getDocumentTypeLabel = (type) => {
    const labels = {
      CONTRACT: '계약서',
      JOB_DESCRIPTION: '직무기술서',
      JOB_OFFER: '채용제안서',
      OTHER: '기타',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">온보딩 정보 로드 중...</p>
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
        {error || '온보딩 정보를 찾을 수 없습니다.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-start">
        <div>
          <button
            onClick={() => navigate('/hr')}
            className="text-blue-600 hover:text-blue-900 text-sm mb-2"
          >
            ← 목록으로 돌아가기
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {onboarding.employee_name}의 온보딩
          </h1>
          <p className="text-gray-600 mt-1">{onboarding.employee_id}</p>
        </div>
        <div className="text-right">
          {getStatusBadge(onboarding.status)}
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
          {error}
        </div>
      )}

      {/* 진행률 카드 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">진행 상황</h2>
          {onboarding.status === 'IN_PROGRESS' && onboarding.completed_percentage === 100 && (
            <button
              onClick={completeOnboarding}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition"
            >
              온보딩 완료
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">전체 진행률</span>
              <span className="text-sm font-bold text-gray-900">{onboarding.completed_percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all"
                style={{ width: `${onboarding.completed_percentage}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">총 작업</p>
              <p className="text-2xl font-bold text-blue-600">{onboarding.tasks.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">완료</p>
              <p className="text-2xl font-bold text-green-600">
                {onboarding.tasks.filter((t) => t.is_completed).length}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">남은 작업</p>
              <p className="text-2xl font-bold text-gray-600">
                {onboarding.tasks.filter((t) => !t.is_completed).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 px-6 py-4 font-medium text-center transition ${
              activeTab === 'tasks'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            작업 목록 ({onboarding.tasks.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 px-6 py-4 font-medium text-center transition ${
              activeTab === 'documents'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            문서 ({onboarding.documents.length})
          </button>
        </div>

        {/* 작업 탭 */}
        {activeTab === 'tasks' && (
          <div className="p-6 space-y-3">
            {onboarding.tasks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">작업 항목이 없습니다.</p>
            ) : (
              onboarding.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <input
                    type="checkbox"
                    checked={task.is_completed}
                    onChange={() => toggleTaskComplete(task.id, task.is_completed)}
                    className="w-5 h-5 mt-1 text-blue-600 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className={`font-medium ${task.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    )}
                    {task.assigned_to_name && (
                      <p className="text-xs text-gray-500 mt-1">담당자: {task.assigned_to_name}</p>
                    )}
                  </div>
                  {task.completed_at && (
                    <p className="text-xs text-gray-500">
                      {new Date(task.completed_at).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 문서 탭 */}
        {activeTab === 'documents' && (
          <div className="p-6 space-y-3">
            {onboarding.documents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">문서가 없습니다.</p>
            ) : (
              onboarding.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📄</span>
                      <div>
                        <p className="font-medium text-gray-900">{doc.title}</p>
                        <p className="text-xs text-gray-500">{getDocumentTypeLabel(doc.document_type)}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      <p>업로드: {new Date(doc.uploaded_at).toLocaleDateString('ko-KR')}</p>
                      {doc.is_signed && (
                        <p className="text-green-600 font-medium">
                          ✓ 서명됨 ({new Date(doc.signed_at).toLocaleDateString('ko-KR')})
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!doc.is_signed && (
                      <button
                        onClick={() => signDocument(doc.id)}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium transition"
                      >
                        서명
                      </button>
                    )}
                    <a
                      href={doc.file}
                      download
                      className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs font-medium transition"
                    >
                      다운로드
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 메모 */}
      {onboarding.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-2">메모</h3>
          <p className="text-gray-700 whitespace-pre-line">{onboarding.notes}</p>
        </div>
      )}
    </div>
  );
}

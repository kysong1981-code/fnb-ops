import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function DailyClosingForm() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    organization: user?.organization_id || '',
    closing_date: new Date().toISOString().split('T')[0],
    pos_card: '',
    pos_cash: '',
    actual_card: '',
    actual_cash: '',
  });

  const [hrCash, setHrCash] = useState({
    amount: '',
    notes: '',
  });

  const [expenses, setExpenses] = useState([]);
  const [newExpense, setNewExpense] = useState({
    category: 'SUPPLIES',
    reason: '',
    amount: '',
    attachment: null,
  });

  const [closingId, setClosingId] = useState(null);
  const [status, setStatus] = useState('DRAFT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 클로징 생성
  const handleCreateClosing = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/closing/closings/', {
        organization: formData.organization,
        closing_date: formData.closing_date,
        pos_card: formData.pos_card,
        pos_cash: formData.pos_cash,
        actual_card: formData.actual_card,
        actual_cash: formData.actual_cash,
      });

      setClosingId(response.data.id);
      setStatus(response.data.status);
      setSuccess('클로징이 생성되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || '클로징 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // HR 현금 추가
  const handleAddHRCash = async (e) => {
    e.preventDefault();
    if (!closingId) {
      setError('먼저 클로징을 생성해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post(`/closing/closings/${closingId}/hr-cash/`, {
        daily_closing: closingId,
        amount: hrCash.amount,
        notes: hrCash.notes,
      });

      setHrCash({ amount: '', notes: '' });
      setSuccess('HR 현금이 추가되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'HR 현금 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 지출 추가
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!closingId) {
      setError('먼저 클로징을 생성해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('daily_closing', closingId);
      formDataToSend.append('category', newExpense.category);
      formDataToSend.append('reason', newExpense.reason);
      formDataToSend.append('amount', newExpense.amount);
      if (newExpense.attachment) {
        formDataToSend.append('attachment', newExpense.attachment);
      }

      await api.post(
        `/closing/closings/${closingId}/expenses/`,
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setNewExpense({
        category: 'SUPPLIES',
        reason: '',
        amount: '',
        attachment: null,
      });
      setSuccess('지출이 추가되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || '지출 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleHRCashChange = (e) => {
    const { name, value } = e.target;
    setHrCash((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleExpenseChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'attachment') {
      setNewExpense((prev) => ({
        ...prev,
        attachment: files[0],
      }));
    } else {
      setNewExpense((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const posTotal = (parseFloat(formData.pos_card) || 0) + (parseFloat(formData.pos_cash) || 0);
  const actualTotal = (parseFloat(formData.actual_card) || 0) + (parseFloat(formData.actual_cash) || 0);
  const variance = actualTotal - posTotal;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">데일리 클로징</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 클로징 정보 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">클로징 정보</h2>

          <form onSubmit={handleCreateClosing} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                폐점 날짜
              </label>
              <input
                type="date"
                name="closing_date"
                value={formData.closing_date}
                onChange={handleInputChange}
                disabled={closingId !== null}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading || closingId !== null}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {loading ? '생성 중...' : closingId ? '생성 완료' : '클로징 생성'}
            </button>
          </form>

          {closingId && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">
                ✓ 클로징 ID: <span className="font-semibold">{closingId}</span>
              </p>
            </div>
          )}
        </div>

        {/* POS 데이터 입력 */}
        {closingId && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">POS 데이터</h2>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    카드 매출
                  </label>
                  <input
                    type="number"
                    name="pos_card"
                    value={formData.pos_card}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    현금 매출
                  </label>
                  <input
                    type="number"
                    name="pos_cash"
                    value={formData.pos_cash}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded text-sm text-gray-700">
                <p>POS 합계: <span className="font-semibold">{posTotal.toLocaleString()}</span></p>
              </div>
            </form>
          </div>
        )}
      </div>

      {closingId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* 실제 데이터 입력 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">실제 데이터</h2>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    실제 카드
                  </label>
                  <input
                    type="number"
                    name="actual_card"
                    value={formData.actual_card}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    실제 현금
                  </label>
                  <input
                    type="number"
                    name="actual_cash"
                    value={formData.actual_cash}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded text-sm text-gray-700">
                <p>실제 합계: <span className="font-semibold">{actualTotal.toLocaleString()}</span></p>
              </div>
            </form>
          </div>

          {/* 차이 분석 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">차이 분석</h2>

            <div className={`p-4 rounded-lg text-center ${
              variance === 0 ? 'bg-green-50' : 'bg-yellow-50'
            }`}>
              <p className="text-sm text-gray-600 mb-2">차이(Variance)</p>
              <p className={`text-3xl font-bold ${
                variance === 0 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {variance.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {variance === 0 ? '✓ 정상' : '⚠ 확인 필요'}
              </p>
            </div>
          </div>

          {/* HR 현금 입력 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">HR 현금</h2>

            <form onSubmit={handleAddHRCash} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  금액
                </label>
                <input
                  type="number"
                  name="amount"
                  value={hrCash.amount}
                  onChange={handleHRCashChange}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비고
                </label>
                <textarea
                  name="notes"
                  value={hrCash.notes}
                  onChange={handleHRCashChange}
                  placeholder="(선택사항)"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !hrCash.amount}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
              >
                {loading ? '추가 중...' : 'HR 현금 추가'}
              </button>
            </form>
          </div>

          {/* 지출 입력 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">현금 지출</h2>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리
                </label>
                <select
                  name="category"
                  value={newExpense.category}
                  onChange={handleExpenseChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SUPPLIES">소비재</option>
                  <option value="MAINTENANCE">유지보수</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사유
                </label>
                <input
                  type="text"
                  name="reason"
                  value={newExpense.reason}
                  onChange={handleExpenseChange}
                  placeholder="지출 사유"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  금액
                </label>
                <input
                  type="number"
                  name="amount"
                  value={newExpense.amount}
                  onChange={handleExpenseChange}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  첨부 파일 (선택)
                </label>
                <input
                  type="file"
                  name="attachment"
                  onChange={handleExpenseChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  최대 5MB (PDF, JPG, PNG)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !newExpense.reason || !newExpense.amount}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition"
              >
                {loading ? '추가 중...' : '지출 추가'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

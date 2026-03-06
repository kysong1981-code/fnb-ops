import React from 'react';

export default function DailyStoreReport({ data }) {
  const formatCurrency = (value) => {
    return `₩${parseInt(value || 0).toLocaleString()}`;
  };

  const getVarianceColor = (variance) => {
    if (variance === 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-orange-600';
  };

  if (!data) return null;

  const { closing, sales, date } = data;

  return (
    <div className="space-y-6">
      {/* 날짜 표시 */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-gray-600">보고 날짜</p>
        <p className="text-2xl font-bold text-gray-900">
          {new Date(date).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short',
          })}
        </p>
      </div>

      {/* 클로징 정보 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">클로징 현황</h2>

        {/* POS 데이터 */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            POS 시스템 기록
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">카드 결제</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(closing.pos_total * 0.7)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">현금</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(closing.pos_total * 0.3)}
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600 mb-1">POS 총합</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(closing.pos_total)}
            </p>
          </div>
        </div>

        {/* 실제 현금 데이터 */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            실제 현금
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">카드 결제</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(closing.actual_total * 0.7)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">현금</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(closing.actual_total * 0.3)}
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-xs text-gray-600 mb-1">실제 총합</p>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(closing.actual_total)}
            </p>
          </div>
        </div>

        {/* HR 현금 */}
        {closing.hr_cash > 0 && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">HR 현금</p>
            <p className="text-2xl font-bold text-yellow-600">
              {formatCurrency(closing.hr_cash)}
            </p>
          </div>
        )}

        {/* 차이 분석 */}
        <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
          <p className="text-xs text-gray-600 mb-1">차이 (Variance)</p>
          <p className={`text-2xl font-bold ${getVarianceColor(closing.variance)}`}>
            {formatCurrency(closing.variance)}
          </p>
          <p className="text-xs text-gray-600 mt-2">
            {closing.variance === 0
              ? '완벽하게 일치합니다'
              : closing.variance < 0
              ? '실제가 POS보다 적습니다'
              : '실제가 POS보다 많습니다'}
          </p>
        </div>

        {/* 상태 */}
        <div className="mt-6 flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              closing.status === 'APPROVED'
                ? 'bg-green-500'
                : closing.status === 'DRAFT'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
          ></div>
          <span className="text-sm font-medium text-gray-700">
            상태: {closing.status === 'APPROVED' ? '승인됨' : closing.status === 'DRAFT' ? '작성중' : '거부됨'}
          </span>
        </div>
      </div>

      {/* 매출 정보 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">매출 현황</h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-xs text-gray-600 mb-1">총 매출</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(sales.total)}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600 mb-1">거래 건수</p>
            <p className="text-2xl font-bold text-blue-600">{sales.transaction_count}건</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="text-xs text-gray-600 mb-1">평균 거래액</p>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(sales.average_transaction)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export default function SalesPerformanceReport({ data }) {
  const formatCurrency = (value) => {
    return `₩${parseInt(value || 0).toLocaleString()}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  if (!data) return null;

  const { period, start_date, end_date, statistics, performance_data } = data;

  const periodLabel = {
    daily: '일별',
    weekly: '주별',
    monthly: '월별',
  }[period] || '기간별';

  const maxSales = Math.max(...performance_data.map((item) => item.total || 0), 1);
  const trendColor = statistics.trend === 'up' ? 'text-green-600' : 'text-red-600';
  const trendArrow = statistics.trend === 'up' ? '↑' : '↓';

  return (
    <div className="space-y-6">
      {/* 기간 표시 */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-gray-600">분석 기간</p>
        <p className="text-lg font-bold text-gray-900">
          {formatDate(start_date)} ~ {formatDate(end_date)} ({periodLabel})
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">총 매출</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(statistics.total)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">평균 매출</p>
          <p className="text-2xl font-bold text-purple-600">
            {formatCurrency(statistics.average)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">최고 매출</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(statistics.max)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">최저 매출</p>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(statistics.min)}
          </p>
        </div>

        <div className={`bg-gradient-to-br ${
          statistics.trend === 'up'
            ? 'from-green-50 to-green-100 border-green-200'
            : 'from-red-50 to-red-100 border-red-200'
        } border rounded-lg p-4`}>
          <p className="text-xs text-gray-600 mb-1">추세</p>
          <p className={`text-2xl font-bold ${trendColor}`}>
            {trendArrow} {statistics.trend === 'up' ? '상승' : '하락'}
          </p>
        </div>
      </div>

      {/* 막대 차트 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{periodLabel} 매출 현황</h2>

        {performance_data.length === 0 ? (
          <p className="text-center text-gray-500 py-8">데이터가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {performance_data.map((item, idx) => {
              const percentage = (item.total / maxSales) * 100;
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-medium text-gray-700 text-right">
                    {period === 'daily' && formatDate(item.period)}
                    {period === 'weekly' && formatDate(item.period)}
                    {period === 'monthly' && item.period}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-full flex items-center justify-end pr-3 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 20 && (
                          <span className="text-xs font-semibold text-white">
                            {formatCurrency(item.total)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(item.total)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.count}건 / {formatCurrency(item.average)} 평균
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 상위/하위 성과 */}
      {performance_data.length > 0 && (
        <div className="grid grid-cols-2 gap-6">
          {/* 최고 성과 */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4">최고 성과</h3>
            {(() => {
              const maxItem = performance_data.reduce((prev, current) =>
                prev.total > current.total ? prev : current
              );
              return (
                <div>
                  <p className="text-sm text-green-700 mb-1">
                    {period === 'daily' && formatDate(maxItem.period)}
                    {period === 'weekly' && formatDate(maxItem.period)}
                    {period === 'monthly' && maxItem.period}
                  </p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatCurrency(maxItem.total)}
                  </p>
                  <p className="text-xs text-green-700 mt-2">
                    {maxItem.count}건 거래 / {formatCurrency(maxItem.average)} 평균
                  </p>
                </div>
              );
            })()}
          </div>

          {/* 최저 성과 */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-900 mb-4">최저 성과</h3>
            {(() => {
              const minItem = performance_data.reduce((prev, current) =>
                prev.total < current.total ? prev : current
              );
              return (
                <div>
                  <p className="text-sm text-orange-700 mb-1">
                    {period === 'daily' && formatDate(minItem.period)}
                    {period === 'weekly' && formatDate(minItem.period)}
                    {period === 'monthly' && minItem.period}
                  </p>
                  <p className="text-3xl font-bold text-orange-600">
                    {formatCurrency(minItem.total)}
                  </p>
                  <p className="text-xs text-orange-700 mt-2">
                    {minItem.count}건 거래 / {formatCurrency(minItem.average)} 평균
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

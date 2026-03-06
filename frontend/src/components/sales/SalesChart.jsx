import React from 'react';

export default function SalesChart({ data, type }) {
  const formatCurrency = (value) => {
    return `₩${parseInt(value).toLocaleString()}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const getBreakdown = () => {
    if (type === 'daily') return data.daily_breakdown || [];
    if (type === 'weekly') return data.weekly_breakdown || [];
    if (type === 'monthly') return data.monthly_breakdown || [];
    return [];
  };

  const breakdown = getBreakdown();
  const maxSales = Math.max(...breakdown.map(item => item.total_sales || item.total || 0), 1);

  const getLabel = (item) => {
    if (type === 'daily') return formatDate(item.date);
    if (type === 'weekly') return `${formatDate(item.week_start)}`;
    if (type === 'monthly') return item.month;
    return '';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {type === 'daily' ? '일별 매출' : type === 'weekly' ? '주별 매출' : '월별 매출'}
        </h3>
        <div className="flex justify-between text-sm text-gray-600">
          <span>기간: {data.start_date} ~ {data.end_date}</span>
          <span>
            총합: <strong>{formatCurrency(data.total_period_sales)}</strong>
          </span>
          <span>
            평균: <strong>{formatCurrency(data.average_daily_sales || data.average_weekly_sales || data.average_monthly_sales)}</strong>
          </span>
        </div>
      </div>

      {/* 바 차트 */}
      <div className="space-y-4">
        {breakdown.length === 0 ? (
          <p className="text-center text-gray-500 py-8">데이터가 없습니다.</p>
        ) : (
          breakdown.map((item, idx) => {
            const salesAmount = item.total_sales || item.total || 0;
            const percentage = (salesAmount / maxSales) * 100;

            return (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-20 text-sm font-medium text-gray-700 text-right">
                  {getLabel(item)}
                </div>
                <div className="flex-1">
                  <div className="bg-gray-200 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-full flex items-center justify-end pr-3 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    >
                      {percentage > 20 && (
                        <span className="text-xs font-semibold text-white">
                          {formatCurrency(salesAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="w-28 text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(salesAmount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.transaction_count || 0}건
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 통계 요약 */}
      <div className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-1">최고 매출</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(
              Math.max(...breakdown.map(item => item.total_sales || item.total || 0), 0)
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-1">평균 매출</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(
              breakdown.length > 0
                ? breakdown.reduce((sum, item) => sum + (item.total_sales || item.total || 0), 0) /
                    breakdown.length
                : 0
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-1">총 거래 건수</p>
          <p className="text-2xl font-bold text-gray-900">
            {breakdown.reduce((sum, item) => sum + (item.transaction_count || 0), 0)}건
          </p>
        </div>
      </div>
    </div>
  );
}

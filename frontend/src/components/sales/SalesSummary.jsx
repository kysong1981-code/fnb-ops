import React from 'react';

export default function SalesSummary({ data }) {
  const formatCurrency = (value) => {
    return `₩${parseInt(value).toLocaleString()}`;
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeIcon = (change) => {
    if (change > 0) return '▲';
    if (change < 0) return '▼';
    return '→';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 오늘 매출 */}
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-600 mb-2">오늘 매출</p>
        <p className="text-3xl font-bold text-gray-900 mb-2">
          {formatCurrency(data.today.total_sales)}
        </p>
        <p className="text-xs text-gray-500">
          거래 건수: {data.today.transaction_count || 0}건
        </p>
      </div>

      {/* 어제 매출 */}
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-600 mb-2">어제 매출</p>
        <p className="text-3xl font-bold text-gray-900 mb-2">
          {formatCurrency(data.yesterday.total_sales)}
        </p>
        <p className="text-xs text-gray-500">
          거래 건수: {data.yesterday.transaction_count || 0}건
        </p>
      </div>

      {/* 매출 변화 */}
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-600 mb-2">오늘 vs 어제</p>
        <div className="flex items-end gap-2">
          <p className={`text-3xl font-bold ${getChangeColor(data.comparison.difference)}`}>
            {formatCurrency(Math.abs(data.comparison.difference))}
          </p>
          <p className={`text-lg ${getChangeColor(data.comparison.difference)}`}>
            {getChangeIcon(data.comparison.difference)}
          </p>
        </div>
        <p className={`text-sm mt-2 ${getChangeColor(data.comparison.percentage_change)}`}>
          {data.comparison.percentage_change > 0 ? '+' : ''}
          {data.comparison.percentage_change.toFixed(1)}%
        </p>
      </div>

      {/* 평균 거래액 */}
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-600 mb-2">평균 거래액 (오늘)</p>
        <p className="text-3xl font-bold text-gray-900 mb-2">
          {formatCurrency(data.today.average_sale)}
        </p>
        <p className="text-xs text-gray-500">
          전체 평균: {formatCurrency(data.total.average_sale)}
        </p>
      </div>
    </div>
  );
}

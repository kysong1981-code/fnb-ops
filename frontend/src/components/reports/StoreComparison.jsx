import React from 'react';

export default function StoreComparison({ data }) {
  const formatCurrency = (value) => {
    return `₩${parseInt(value || 0).toLocaleString()}`;
  };

  const getVarianceColor = (variance) => {
    if (variance === 0) return 'bg-green-50 border-green-200 text-green-700';
    if (variance < 0) return 'bg-red-50 border-red-200 text-red-700';
    return 'bg-orange-50 border-orange-200 text-orange-700';
  };

  if (!data || !data.stores) return null;

  const { date, stores } = data;
  const totalStores = stores.length;
  const totalClosingSales = stores.reduce((sum, s) => sum + s.closing_actual_total, 0);
  const totalSales = stores.reduce((sum, s) => sum + s.sales_total, 0);

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

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600 mb-1">총 매장 수</p>
          <p className="text-3xl font-bold text-gray-900">{totalStores}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600 mb-1">클로징 총액</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalClosingSales)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600 mb-1">매출 총액</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSales)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600 mb-1">평균 매출</p>
          <p className="text-2xl font-bold text-purple-600">
            {formatCurrency(totalSales / Math.max(totalStores, 1))}
          </p>
        </div>
      </div>

      {/* 매장 비교 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  매장명
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  클로징 POS
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  실제 현금
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  차이
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  매출
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  거래 건수
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  평균
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stores.map((store, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium text-gray-900">{store.organization}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(store.closing_pos_total)}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(store.closing_actual_total)}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className={`inline-block px-3 py-1 rounded text-sm font-semibold border ${getVarianceColor(store.closing_variance)}`}>
                      {formatCurrency(store.closing_variance)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <p className="text-sm font-medium text-green-600">
                      {formatCurrency(store.sales_total)}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <p className="text-sm font-medium text-gray-900">{store.sales_count}건</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <p className="text-sm font-medium text-purple-600">
                      {formatCurrency(store.sales_average)}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 차이 분석 요약 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">차이 분석</h3>
        <div className="grid grid-cols-2 gap-4">
          {stores.map((store, idx) => (
            <div key={idx} className={`p-4 rounded-lg border ${getVarianceColor(store.closing_variance)}`}>
              <p className="text-sm font-medium mb-1">{store.organization}</p>
              <p className="text-xl font-bold">
                {formatCurrency(store.closing_variance)}
              </p>
              <p className="text-xs mt-2">
                {store.closing_variance === 0
                  ? '✓ 완벽하게 일치'
                  : store.closing_variance < 0
                  ? `실제 ${Math.abs(store.closing_variance)} 부족`
                  : `실제 ${store.closing_variance} 초과`}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

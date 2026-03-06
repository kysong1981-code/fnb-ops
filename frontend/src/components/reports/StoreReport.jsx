import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import DailyStoreReport from './DailyStoreReport';
import StoreComparison from './StoreComparison';
import SalesPerformanceReport from './SalesPerformanceReport';

export default function StoreReport() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('daily'); // daily, comparison, performance
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDate]);

  const fetchReport = async () => {
    setLoading(true);
    setError('');

    try {
      let response;

      if (reportType === 'daily') {
        response = await api.get('/reports/daily_store_report/', {
          params: { date: selectedDate },
        });
      } else if (reportType === 'comparison') {
        response = await api.get('/reports/store_comparison/', {
          params: { date: selectedDate },
        });
      } else if (reportType === 'performance') {
        response = await api.get('/reports/sales_performance/', {
          params: { period: 'daily', days: 30 },
        });
      }

      setReportData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || '리포트 로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">매장 리포트</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* 리포트 타입 선택 */}
      <div className="mb-6 bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex gap-2">
          {['daily', 'comparison', 'performance'].map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                reportType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type === 'daily' ? '일일' : type === 'comparison' ? '매장비교' : '성과분석'}
            </button>
          ))}
        </div>

        {reportType !== 'performance' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              날짜 선택
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* 리포트 콘텐츠 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">리포트 생성 중...</p>
        </div>
      ) : reportData ? (
        <>
          {reportType === 'daily' && <DailyStoreReport data={reportData} />}
          {reportType === 'comparison' && <StoreComparison data={reportData} />}
          {reportType === 'performance' && <SalesPerformanceReport data={reportData} />}
        </>
      ) : null}
    </div>
  );
}

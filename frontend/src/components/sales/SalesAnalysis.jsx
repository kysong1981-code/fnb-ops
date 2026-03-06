import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import SalesSummary from './SalesSummary';
import SalesChart from './SalesChart';

export default function SalesAnalysis() {
  const { user } = useAuth();
  const [analysisType, setAnalysisType] = useState('daily'); // daily, weekly, monthly
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    fetchSalesData();
  }, [analysisType]);

  const fetchSalesData = async () => {
    setLoading(true);
    setError('');

    try {
      // 요약 데이터 조회
      const summaryResponse = await api.get('/sales/summary/');
      setSummaryData(summaryResponse.data);

      // 분석 데이터 조회
      let analysisResponse;
      const today = new Date().toISOString().split('T')[0];
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      if (analysisType === 'daily') {
        analysisResponse = await api.get('/sales/daily_analysis/', {
          params: { start_date: lastWeek, end_date: today },
        });
      } else if (analysisType === 'weekly') {
        analysisResponse = await api.get('/sales/weekly_analysis/', {
          params: { weeks: 4 },
        });
      } else if (analysisType === 'monthly') {
        analysisResponse = await api.get('/sales/monthly_analysis/', {
          params: { months: 12 },
        });
      }

      setChartData(analysisResponse.data);
    } catch (err) {
      setError(err.response?.data?.detail || '매출 데이터 로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">매출 분석</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* 요약 정보 */}
      {summaryData && !loading && <SalesSummary data={summaryData} />}

      {/* 분석 유형 탭 */}
      <div className="mb-6 flex gap-2 bg-white rounded-lg shadow p-4">
        {['daily', 'weekly', 'monthly'].map((type) => (
          <button
            key={type}
            onClick={() => setAnalysisType(type)}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              analysisType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type === 'daily' ? '일별' : type === 'weekly' ? '주별' : '월별'}
          </button>
        ))}
      </div>

      {/* 차트 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">분석 중...</p>
        </div>
      ) : chartData ? (
        <SalesChart data={chartData} type={analysisType} />
      ) : null}
    </div>
  );
}

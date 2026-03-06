import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function PayslipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPayslip();
  }, [id]);

  const fetchPayslip = async () => {
    setLoading(true);
    setError('');

    try {
      const [payslipRes, summaryRes] = await Promise.all([
        api.get(`/payroll/payslips/${id}/`),
        api.get(`/payroll/payslips/${id}/summary/`)
      ]);
      setPayslip(payslipRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      setError(err.response?.data?.error || '급여명세서를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return `NZ$${parseFloat(value || 0).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">급여명세서 로드 중...</p>
      </div>
    );
  }

  if (!payslip || !summary) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
        {error || '급여명세서를 찾을 수 없습니다.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-start">
        <div>
          <button
            onClick={() => navigate('/payroll')}
            className="text-blue-600 hover:text-blue-900 text-sm mb-2"
          >
            ← 목록으로 돌아가기
          </button>
          <h1 className="text-3xl font-bold text-gray-900">급여명세서</h1>
          <p className="text-gray-600 mt-1">{summary.employee}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          인쇄
        </button>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white rounded-lg shadow p-6 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-gray-600 mb-1">급여 기간</p>
          <p className="text-lg font-semibold text-gray-900">{summary.period}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">지급일</p>
          <p className="text-lg font-semibold text-gray-900">
            {new Date(payslip.pay_period_details.payment_date).toLocaleDateString('ko-KR')}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">IRD 번호</p>
          <p className="text-lg font-semibold text-gray-900">{summary.employee || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">근무 형태</p>
          <p className="text-lg font-semibold text-gray-900">
            {payslip.work_type === 'FULL_TIME' ? '정규직' : payslip.work_type === 'PART_TIME' ? '파트타임' : '계약직'}
          </p>
        </div>
      </div>

      {/* 근무 시간 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">근무 시간</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">정규 시간</p>
            <p className="text-2xl font-bold text-blue-600">{summary.hours.regular}h</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">초과 시간</p>
            <p className="text-2xl font-bold text-orange-600">{summary.hours.overtime}h</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">총 시간</p>
            <p className="text-2xl font-bold text-gray-900">{summary.hours.total}h</p>
          </div>
        </div>
      </div>

      {/* 급여 계산 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">급여 계산</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">시급</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(payslip.hourly_rate)}/h
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">정규 급여</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(summary.earnings.regular_pay)}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">초과 시급</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(payslip.overtime_rate)}/h
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">초과 급여</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(summary.earnings.overtime_pay)}
            </span>
          </div>
          <div className="border-t-2 border-gray-200 flex justify-between items-center p-3 bg-blue-50 rounded">
            <span className="text-sm font-bold text-gray-900">총 급여 (Gross)</span>
            <span className="text-lg font-bold text-blue-600">
              {formatCurrency(summary.earnings.gross_salary)}
            </span>
          </div>
        </div>
      </div>

      {/* 공제 사항 (뉴질랜드) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">공제 사항 (뉴질랜드)</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">PAYE 소득세</span>
            <span className="text-sm font-semibold text-red-600">
              -{formatCurrency(summary.deductions.paye_tax)}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">Kiwisaver (직원)</span>
            <span className="text-sm font-semibold text-red-600">
              -{formatCurrency(summary.deductions.kiwisaver)}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">ACC 산재보험</span>
            <span className="text-sm font-semibold text-red-600">
              -{formatCurrency(summary.deductions.acc_levy)}
            </span>
          </div>
          {summary.deductions.other > 0 && (
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">기타 공제</span>
              <span className="text-sm font-semibold text-red-600">
                -{formatCurrency(summary.deductions.other)}
              </span>
            </div>
          )}
          <div className="border-t-2 border-gray-200 flex justify-between items-center p-3 bg-red-50 rounded">
            <span className="text-sm font-bold text-gray-900">총 공제액</span>
            <span className="text-lg font-bold text-red-600">
              -{formatCurrency(summary.deductions.total)}
            </span>
          </div>
        </div>
      </div>

      {/* 순급여 */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-6">
        <p className="text-sm text-gray-600 mb-2">순급여 (Net Salary)</p>
        <p className="text-4xl font-bold text-green-600">{formatCurrency(summary.net_salary)}</p>
      </div>

      {/* 고용주 기여금 (참고용) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">고용주 기여금 (참고용)</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">Kiwisaver 고용주 기여금 (3%)</span>
            <span className="text-sm font-semibold text-gray-900">
              +{formatCurrency(summary.employer_contributions.kiwisaver)}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">ACC 고용주 기여금</span>
            <span className="text-sm font-semibold text-gray-900">
              +{formatCurrency(summary.employer_contributions.acc_levy)}
            </span>
          </div>
        </div>
      </div>

      {/* 메모 */}
      {payslip.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-2">메모</h3>
          <p className="text-gray-700 whitespace-pre-line">{payslip.notes}</p>
        </div>
      )}

      {/* 법적 고지 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-xs text-gray-600">
        <p>이 급여명세서는 뉴질랜드 임금관계법(Employment Relations Act)에 따라 작성되었습니다.</p>
        <p className="mt-2">
          질문이나 오류가 있는 경우, 회사의 급여 담당자에게 문의하시기 바랍니다.
        </p>
      </div>
    </div>
  );
}

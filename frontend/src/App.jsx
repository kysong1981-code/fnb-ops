import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import LoginPage from './components/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Dashboard from './components/dashboard/Dashboard'
import DailyClosingForm from './components/closing/DailyClosingForm'
import ClosingList from './components/closing/ClosingList'
import SalesAnalysis from './components/sales/SalesAnalysis'
import StoreReport from './components/reports/StoreReport'
import OnboardingList from './components/hr/OnboardingList'
import OnboardingDetail from './components/hr/OnboardingDetail'
import MyPayslips from './components/payroll/MyPayslips'
import PayslipDetail from './components/payroll/PayslipDetail'
import SafetyDashboard from './components/safety/SafetyDashboard'
import ChecklistList from './components/safety/DailyChecklist/ChecklistList'
import ChecklistForm from './components/safety/DailyChecklist/ChecklistForm'
import ChecklistDetail from './components/safety/DailyChecklist/ChecklistDetail'
import TemperatureForm from './components/safety/TemperatureLog/TemperatureForm'
import TemperatureList from './components/safety/TemperatureLog/TemperatureList'
import TemperatureAlert from './components/safety/TemperatureLog/TemperatureAlert'
import IncidentList from './components/safety/Incidents/IncidentList'
import IncidentForm from './components/safety/Incidents/IncidentForm'
import IncidentDetail from './components/safety/Incidents/IncidentDetail'
import CleaningForm from './components/safety/CleaningManagement/CleaningForm'
import CleaningSchedule from './components/safety/CleaningManagement/CleaningSchedule'
import CleaningHistory from './components/safety/CleaningManagement/CleaningHistory'
import TrainingForm from './components/safety/TrainingManagement/TrainingForm'
import TrainingList from './components/safety/TrainingManagement/TrainingList'
import TrainingStatus from './components/safety/TrainingManagement/TrainingStatus'
import VerificationForm from './components/safety/SelfVerification/VerificationForm'
import VerificationList from './components/safety/SelfVerification/VerificationList'
import VerificationReport from './components/safety/SelfVerification/VerificationReport'
import DocumentLibrary from './components/documents/DocumentLibrary'
import DocumentUpload from './components/documents/DocumentUpload'
import DocumentDetail from './components/documents/DocumentDetail'
import DocumentVersionHistory from './components/documents/DocumentVersionHistory'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* 로그인 페이지 */}
          <Route path="/login" element={<LoginPage />} />

          {/* 대시보드 (보호됨) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* 클로징 목록 (보호됨) */}
          <Route
            path="/closing"
            element={
              <ProtectedRoute>
                <ClosingList />
              </ProtectedRoute>
            }
          />

          {/* 클로징 폼 (보호됨) */}
          <Route
            path="/closing/form"
            element={
              <ProtectedRoute>
                <DailyClosingForm />
              </ProtectedRoute>
            }
          />

          {/* 매출 분석 (보호됨) */}
          <Route
            path="/sales"
            element={
              <ProtectedRoute>
                <SalesAnalysis />
              </ProtectedRoute>
            }
          />

          {/* 매장 리포트 (보호됨) */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <StoreReport />
              </ProtectedRoute>
            }
          />

          {/* HR/온보딩 목록 (보호됨) */}
          <Route
            path="/hr"
            element={
              <ProtectedRoute>
                <OnboardingList />
              </ProtectedRoute>
            }
          />

          {/* HR/온보딩 상세 (보호됨) */}
          <Route
            path="/hr/:id"
            element={
              <ProtectedRoute>
                <OnboardingDetail />
              </ProtectedRoute>
            }
          />

          {/* 급여명세서 목록 (보호됨) */}
          <Route
            path="/payroll"
            element={
              <ProtectedRoute>
                <MyPayslips />
              </ProtectedRoute>
            }
          />

          {/* 급여명세서 상세 (보호됨) */}
          <Route
            path="/payroll/:id"
            element={
              <ProtectedRoute>
                <PayslipDetail />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 메인 대시보드 (보호됨) */}
          <Route
            path="/safety"
            element={
              <ProtectedRoute>
                <SafetyDashboard />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 체크리스트 목록 (보호됨) */}
          <Route
            path="/safety/checklists"
            element={
              <ProtectedRoute>
                <ChecklistList />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 새 체크리스트 (보호됨) */}
          <Route
            path="/safety/checklists/new"
            element={
              <ProtectedRoute>
                <ChecklistForm />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 체크리스트 상세 (보호됨) */}
          <Route
            path="/safety/checklists/:id"
            element={
              <ProtectedRoute>
                <ChecklistDetail />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 체크리스트 편집 (보호됨) */}
          <Route
            path="/safety/checklists/:id/edit"
            element={
              <ProtectedRoute>
                <ChecklistForm />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 온도 목록 (보호됨) */}
          <Route
            path="/safety/temperatures"
            element={
              <ProtectedRoute>
                <TemperatureList />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 온도 입력 (보호됨) */}
          <Route
            path="/safety/temperatures/new"
            element={
              <ProtectedRoute>
                <TemperatureForm />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 온도 경고 (보호됨) */}
          <Route
            path="/safety/temperature-alerts"
            element={
              <ProtectedRoute>
                <TemperatureAlert />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 사건 목록 (보호됨) */}
          <Route
            path="/safety/incidents"
            element={
              <ProtectedRoute>
                <IncidentList />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 새 사건 보고 (보호됨) */}
          <Route
            path="/safety/incidents/new"
            element={
              <ProtectedRoute>
                <IncidentForm />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 사건 상세 (보호됨) */}
          <Route
            path="/safety/incidents/:id"
            element={
              <ProtectedRoute>
                <IncidentDetail />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 사건 편집 (보호됨) */}
          <Route
            path="/safety/incidents/:id/edit"
            element={
              <ProtectedRoute>
                <IncidentForm />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 청소 기록 (보호됨) */}
          <Route
            path="/safety/cleaning"
            element={
              <ProtectedRoute>
                <CleaningForm />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 주간 청소 일정 (보호됨) */}
          <Route
            path="/safety/cleaning/schedule"
            element={
              <ProtectedRoute>
                <CleaningSchedule />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 청소 이력 (보호됨) */}
          <Route
            path="/safety/cleaning/history"
            element={
              <ProtectedRoute>
                <CleaningHistory />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 교육 목록 (보호됨) */}
          <Route
            path="/safety/training"
            element={
              <ProtectedRoute>
                <TrainingList />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 새 교육 (보호됨) */}
          <Route
            path="/safety/training/new"
            element={
              <ProtectedRoute>
                <TrainingForm />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 직원 교육 현황 (보호됨) */}
          <Route
            path="/safety/training/status"
            element={
              <ProtectedRoute>
                <TrainingStatus />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 검증 작성 (보호됨) */}
          <Route
            path="/safety/verifications"
            element={
              <ProtectedRoute>
                <VerificationForm />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 검증 기록 목록 (보호됨) */}
          <Route
            path="/safety/verifications/list"
            element={
              <ProtectedRoute>
                <VerificationList />
              </ProtectedRoute>
            }
          />

          {/* 음식 안전 관리 - 검증 보고서 (보호됨) */}
          <Route
            path="/safety/verifications/:id"
            element={
              <ProtectedRoute>
                <VerificationReport />
              </ProtectedRoute>
            }
          />

          {/* 자료 라이브러리 (보호됨) */}
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DocumentLibrary />
              </ProtectedRoute>
            }
          />

          {/* 문서 업로드 (보호됨) */}
          <Route
            path="/documents/upload"
            element={
              <ProtectedRoute>
                <DocumentUpload />
              </ProtectedRoute>
            }
          />

          {/* 문서 상세 (보호됨) */}
          <Route
            path="/documents/:id"
            element={
              <ProtectedRoute>
                <DocumentDetail />
              </ProtectedRoute>
            }
          />

          {/* 문서 버전 이력 (보호됨) */}
          <Route
            path="/documents/:id/versions"
            element={
              <ProtectedRoute>
                <DocumentVersionHistory />
              </ProtectedRoute>
            }
          />

          {/* 루트 경로 - 대시보드로 리다이렉트 */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 존재하지 않는 경로 - 대시보드로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App

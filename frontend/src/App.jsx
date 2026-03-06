import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import LoginPage from './components/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Dashboard from './components/dashboard/Dashboard'
import DailyClosingForm from './components/closing/DailyClosingForm'
import ClosingList from './components/closing/ClosingList'
import SalesAnalysis from './components/sales/SalesAnalysis'
import StoreReport from './components/reports/StoreReport'

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

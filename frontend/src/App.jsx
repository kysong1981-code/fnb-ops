import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { StoreProvider } from './context/StoreContext'
import LoginPage from './components/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './components/dashboard/Dashboard'
import DailyClosingForm from './components/closing/DailyClosingForm'
import ClosingList from './components/closing/ClosingList'
import ClosingMonthlyView from './components/closing/ClosingMonthlyView'
import CashUpPage from './components/closing/CashUpPage'
import SalesAnalysis from './components/sales/SalesAnalysis'
import StoreReport from './components/reports/StoreReport'
import SkyReport from './components/reports/SkyReport'
import HRHub from './components/hr/HRHub'
import EmployeeFilePage from './components/hr/EmployeeFilePage'
import OnboardingDetail from './components/hr/OnboardingDetail'
import AcceptInvite from './components/hr/AcceptInvite'
import MyPayslips from './components/payroll/MyPayslips'
import PayslipDetail from './components/payroll/PayslipDetail'
import PayrollHub from './components/payroll/PayrollHub'
import MyLeave from './components/payroll/MyLeave'
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
import MyTasks from './components/tasks/MyTasks'
import TimeTracking from './components/timesheet/TimeTracking'
import MyRoster from './components/timesheet/MyRoster'
import MyPage from './components/profile/MyPage'
import StoreSettings from './components/settings/StoreSettings'
import RosterManagement from './components/manager/RosterManagement'
import TimesheetReview from './components/manager/TimesheetReview'
import AssignTasks from './components/manager/AssignTasks'
import ShiftTemplateSettings from './components/manager/ShiftTemplateSettings'
import InspectionReport from './components/safety/inspection/InspectionReport'
import InquiriesManager from './components/hr/InquiriesManager'
import GetStartedPage from './components/auth/GetStartedPage'
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword'
import StoreApplications from './components/admin/StoreApplications'
import StoreAssignment from './components/admin/StoreAssignment'
import ManagerRoute from './components/auth/ManagerRoute'
import ImportPage from './components/import/ImportPage'
import CQReport from './components/reports/CQReport'
import StoreEvaluation from './components/reports/StoreEvaluation'

// Helper component to wrap protected routes with Layout
function ProtectedWithLayout({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

// Manager-only routes (redirects Employee to dashboard)
function ManagerWithLayout({ children }) {
  return (
    <ProtectedRoute>
      <ManagerRoute>
        <Layout>{children}</Layout>
      </ManagerRoute>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <StoreProvider>
        <Routes>
          {/* Login page (no sidebar) */}
          <Route path="/login" element={<LoginPage />} />

          {/* Public: Forgot Password / Reset Password */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />

          {/* Public: Get Started (store application) */}
          <Route path="/get-started" element={<GetStartedPage />} />

          {/* Public: Accept Invite (no sidebar) */}
          <Route path="/invite/:inviteCode" element={<AcceptInvite />} />

          {/* Dashboard (with sidebar) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedWithLayout>
                <Dashboard />
              </ProtectedWithLayout>
            }
          />

          {/* Daily Closing (with sidebar) */}
          <Route
            path="/closing"
            element={
              <ProtectedWithLayout>
                <DailyClosingForm />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/closing/form"
            element={
              <ProtectedWithLayout>
                <DailyClosingForm />
              </ProtectedWithLayout>
            }
          />

          {/* Closing Monthly Calendar */}
          <Route
            path="/closing/monthly"
            element={
              <ProtectedWithLayout>
                <ClosingMonthlyView />
              </ProtectedWithLayout>
            }
          />

          {/* Cash Up (manager only) */}
          <Route
            path="/cashup"
            element={
              <ProtectedWithLayout>
                <CashUpPage />
              </ProtectedWithLayout>
            }
          />

          {/* HR Cash redirect to Cash Up */}
          <Route path="/hr-cash" element={<Navigate to="/cashup" replace />} />

          {/* Data Import */}
          <Route
            path="/import"
            element={
              <ProtectedWithLayout>
                <ImportPage />
              </ProtectedWithLayout>
            }
          />

          {/* Store Evaluation (CEO/HQ only) */}
          <Route
            path="/evaluation"
            element={
              <ProtectedWithLayout>
                <StoreEvaluation />
              </ProtectedWithLayout>
            }
          />

          {/* CQ Report (admin only) */}
          <Route
            path="/cq-report"
            element={
              <ProtectedWithLayout>
                <CQReport />
              </ProtectedWithLayout>
            }
          />

          {/* Sales Analysis (with sidebar) */}
          <Route
            path="/sales"
            element={
              <ProtectedWithLayout>
                <SalesAnalysis />
              </ProtectedWithLayout>
            }
          />

          {/* Reports (with sidebar) */}
          <Route
            path="/reports"
            element={
              <ProtectedWithLayout>
                <StoreReport />
              </ProtectedWithLayout>
            }
          />

          {/* Sky Report (with sidebar) */}
          <Route
            path="/sky-report"
            element={
              <ProtectedWithLayout>
                <SkyReport />
              </ProtectedWithLayout>
            }
          />

          {/* HR Management (with sidebar) */}
          <Route
            path="/hr"
            element={
              <ProtectedWithLayout>
                <HRHub />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/hr/employee-file/:id"
            element={
              <ProtectedWithLayout>
                <EmployeeFilePage />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/hr/onboarding/:id"
            element={
              <ProtectedWithLayout>
                <OnboardingDetail />
              </ProtectedWithLayout>
            }
          />

          {/* Payroll Manager Hub */}
          <Route
            path="/manager/payroll"
            element={
              <ProtectedWithLayout>
                <PayrollHub />
              </ProtectedWithLayout>
            }
          />

          {/* My Leave (employee) */}
          <Route
            path="/leave"
            element={
              <ProtectedWithLayout>
                <MyLeave />
              </ProtectedWithLayout>
            }
          />

          {/* Payroll / My Payslips (with sidebar) */}
          <Route
            path="/payroll"
            element={
              <ProtectedWithLayout>
                <MyPayslips />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/payroll/:id"
            element={
              <ProtectedWithLayout>
                <PayslipDetail />
              </ProtectedWithLayout>
            }
          />

          {/* My Tasks (with sidebar) */}
          <Route
            path="/tasks"
            element={
              <ProtectedWithLayout>
                <MyTasks />
              </ProtectedWithLayout>
            }
          />

          {/* Time Clock (with sidebar) */}
          <Route
            path="/timesheet"
            element={
              <ProtectedWithLayout>
                <TimeTracking />
              </ProtectedWithLayout>
            }
          />

          {/* My Roster (with sidebar) */}
          <Route
            path="/roster"
            element={
              <ProtectedWithLayout>
                <MyRoster />
              </ProtectedWithLayout>
            }
          />

          {/* My Page (with sidebar) */}
          <Route
            path="/mypage"
            element={
              <ProtectedWithLayout>
                <MyPage />
              </ProtectedWithLayout>
            }
          />

          {/* Store Settings (with sidebar) */}
          <Route
            path="/store-settings"
            element={
              <ProtectedWithLayout>
                <StoreSettings />
              </ProtectedWithLayout>
            }
          />

          {/* Manager Dashboard (with sidebar) */}
          <Route
            path="/manager"
            element={
              <ProtectedWithLayout>
                <Dashboard />
              </ProtectedWithLayout>
            }
          />

          {/* Manager - Roster Management */}
          <Route
            path="/manager/roster"
            element={
              <ProtectedWithLayout>
                <RosterManagement />
              </ProtectedWithLayout>
            }
          />

          {/* Manager - Roster Template Settings */}
          <Route
            path="/manager/roster/settings"
            element={
              <ProtectedWithLayout>
                <ShiftTemplateSettings />
              </ProtectedWithLayout>
            }
          />

          {/* Manager - Timesheet Review */}
          <Route
            path="/manager/timesheet-review"
            element={
              <ProtectedWithLayout>
                <TimesheetReview />
              </ProtectedWithLayout>
            }
          />

          {/* Manager - Assign Tasks */}
          <Route
            path="/manager/assign-tasks"
            element={
              <ProtectedWithLayout>
                <AssignTasks />
              </ProtectedWithLayout>
            }
          />

          {/* Manager - Inquiries */}
          <Route
            path="/inquiries"
            element={
              <ProtectedWithLayout>
                <InquiriesManager />
              </ProtectedWithLayout>
            }
          />

          {/* Admin - Store Applications */}
          <Route
            path="/admin/applications"
            element={
              <ManagerWithLayout>
                <StoreApplications />
              </ManagerWithLayout>
            }
          />

          {/* Admin - Store Assignment */}
          <Route
            path="/admin/store-assignment"
            element={
              <ManagerWithLayout>
                <StoreAssignment />
              </ManagerWithLayout>
            }
          />

          {/* Food Safety Inspection Report */}
          <Route
            path="/safety/inspection"
            element={
              <ProtectedWithLayout>
                <InspectionReport />
              </ProtectedWithLayout>
            }
          />

          {/* Food Safety (with sidebar) */}
          <Route
            path="/safety"
            element={
              <ProtectedWithLayout>
                <SafetyDashboard />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/checklists"
            element={
              <ProtectedWithLayout>
                <ChecklistList />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/checklists/new"
            element={
              <ProtectedWithLayout>
                <ChecklistForm />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/checklists/:id"
            element={
              <ProtectedWithLayout>
                <ChecklistDetail />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/checklists/:id/edit"
            element={
              <ProtectedWithLayout>
                <ChecklistForm />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/temperatures"
            element={
              <ProtectedWithLayout>
                <TemperatureList />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/temperatures/new"
            element={
              <ProtectedWithLayout>
                <TemperatureForm />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/temperature-alerts"
            element={
              <ProtectedWithLayout>
                <TemperatureAlert />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/incidents"
            element={
              <ProtectedWithLayout>
                <IncidentList />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/incidents/new"
            element={
              <ProtectedWithLayout>
                <IncidentForm />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/incidents/:id"
            element={
              <ProtectedWithLayout>
                <IncidentDetail />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/incidents/:id/edit"
            element={
              <ProtectedWithLayout>
                <IncidentForm />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/cleaning"
            element={
              <ProtectedWithLayout>
                <CleaningForm />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/cleaning/schedule"
            element={
              <ProtectedWithLayout>
                <CleaningSchedule />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/cleaning/history"
            element={
              <ProtectedWithLayout>
                <CleaningHistory />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/training"
            element={
              <ProtectedWithLayout>
                <TrainingList />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/training/new"
            element={
              <ProtectedWithLayout>
                <TrainingForm />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/training/status"
            element={
              <ProtectedWithLayout>
                <TrainingStatus />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/verifications"
            element={
              <ProtectedWithLayout>
                <VerificationForm />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/verifications/list"
            element={
              <ProtectedWithLayout>
                <VerificationList />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/safety/verifications/:id"
            element={
              <ProtectedWithLayout>
                <VerificationReport />
              </ProtectedWithLayout>
            }
          />

          {/* Documents (with sidebar) */}
          <Route
            path="/documents"
            element={
              <ProtectedWithLayout>
                <DocumentLibrary />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/documents/upload"
            element={
              <ProtectedWithLayout>
                <DocumentUpload />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/documents/:id"
            element={
              <ProtectedWithLayout>
                <DocumentDetail />
              </ProtectedWithLayout>
            }
          />

          <Route
            path="/documents/:id/versions"
            element={
              <ProtectedWithLayout>
                <DocumentVersionHistory />
              </ProtectedWithLayout>
            }
          />

          {/* Root path - redirect to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </StoreProvider>
      </AuthProvider>
    </Router>
  )
}

export default App

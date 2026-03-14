import axios from 'axios'

// API base URL - uses environment variable if set, otherwise relative /api (works with Nginx proxy)
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

// axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - JWT 토큰 자동 추가 + CEO/HQ store_id 자동 추가
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // CEO/HQ: 선택된 store_id를 자동으로 쿼리 파라미터에 추가
    const storeId = localStorage.getItem('selected_store_id')
    if (storeId) {
      config.params = config.params || {}
      if (!config.params.store_id) {
        config.params.store_id = storeId
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - 401 시 토큰 자동 갱신
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        })
        localStorage.setItem('access_token', data.access)
        api.defaults.headers.common.Authorization = `Bearer ${data.access}`
        processQueue(null, data.access)
        originalRequest.headers.Authorization = `Bearer ${data.access}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api

// API 함수들 (필요에 따라 추가)
export const authAPI = {
  // 로그인 (email-based)
  login: (email, password) =>
    api.post('/auth/token/', { email, password }),

  // 회원가입
  register: (userData) => api.post('/auth/register/', userData),

  // 프로필 조회/수정
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (data) => api.patch('/auth/profile/', data),

  // 비밀번호 변경
  changePassword: (data) => api.post('/auth/change-password/', data),

  // 비밀번호 초기화
  requestPasswordReset: (email) => api.post('/auth/password-reset/', { email }),
  confirmPasswordReset: (data) => api.post('/auth/password-reset/confirm/', data),

  // 권한 확인
  checkPermission: (resource, action) =>
    api.post('/auth/check-permission/', { resource, action }),
}

// 클로징 관련 API
export const closingAPI = {
  // 클로징 목록 (쿼리 필터: closing_date, status)
  list: (params) => api.get('/closing/closings/', { params }),

  // 클로징 생성
  create: (data) => api.post('/closing/closings/', data),

  // 클로징 상세 조회
  get: (id) => api.get(`/closing/closings/${id}/`),

  // 클로징 업데이트
  update: (id, data) => api.put(`/closing/closings/${id}/`, data),

  // 클로징 부분 업데이트
  patch: (id, data) => api.patch(`/closing/closings/${id}/`, data),

  // 직원 제출 (DRAFT → SUBMITTED)
  submit: (id) => api.post(`/closing/closings/${id}/submit/`),

  // 매니저 승인
  approve: (id) => api.post(`/closing/closings/${id}/approve/`),

  // 매니저 거부
  reject: (id, data) => api.post(`/closing/closings/${id}/reject/`, data),

  // 날짜로 조회
  getByDate: (date) => api.get('/closing/closings/', { params: { closing_date: date } }),
}

// HR Cash API (매니저 전용)
export const hrCashAPI = {
  list: (params) => api.get('/closing/hr-cash/', { params }),
  create: (formData) =>
    api.post('/closing/hr-cash/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id, formData) =>
    api.patch(`/closing/hr-cash/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id) => api.delete(`/closing/hr-cash/${id}/`),
  balance: () => api.get('/closing/hr-cash/balance/'),
}

// Cash Expense API (매니저 전용)
export const cashExpenseAPI = {
  list: (params) => api.get('/closing/expenses/', { params }),
  create: (formData) =>
    api.post('/closing/expenses/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id, formData) =>
    api.patch(`/closing/expenses/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id) => api.delete(`/closing/expenses/${id}/`),
}

// 매출 관련 API (향후)
export const salesAPI = {
  list: () => api.get('/sales/'),
  get: (id) => api.get(`/sales/${id}/`),
}

// HR 관련 API
export const hrAPI = {
  // Roster
  getRosters: () => api.get('/hr/rosters/'),
  getRosterWeekly: (date) => api.get('/hr/rosters/weekly/', { params: { date } }),
  createRoster: (data) => api.post('/hr/rosters/', data),
  updateRoster: (id, data) => api.patch(`/hr/rosters/${id}/`, data),
  deleteRoster: (id) => api.delete(`/hr/rosters/${id}/`),
  bulkDeleteRosters: (ids) => api.post('/hr/rosters/bulk-delete/', { ids }),

  // Timesheet
  getTimesheets: () => api.get('/hr/timesheets/'),
  getTimesheetWeekly: (date) => api.get('/hr/timesheets/weekly/', { params: { date } }),
  approveTimesheet: (id) => api.post(`/hr/timesheets/${id}/approve/`),
  approveOvertime: (id) => api.post(`/hr/timesheets/${id}/approve-overtime/`),

  // Time Clock (employee)
  getTimesheetToday: () => api.get('/hr/timesheets/today/'),
  clockIn: () => api.post('/hr/timesheets/clock_in/'),
  clockOut: (data) => api.post('/hr/timesheets/clock_out/', data),
  breakStart: () => api.post('/hr/timesheets/break_start/'),
  breakEnd: () => api.post('/hr/timesheets/break_end/'),

  // My Roster (employee)
  getMyRoster: () => api.get('/hr/rosters/my-roster/'),

  // Tasks
  getTasks: (params) => api.get('/hr/tasks/', { params }),
  createTask: (data) => api.post('/hr/tasks/', data),
  updateTask: (id, data) => api.patch(`/hr/tasks/${id}/`, data),
  completeTask: (id) => api.post(`/hr/tasks/${id}/complete/`),
  startTask: (id) => api.post(`/hr/tasks/${id}/start/`),

  // Team
  getTeam: (params) => api.get('/hr/team/', { params }),
  getTeamMember: (id) => api.get(`/hr/team/${id}/`),
  updateSalary: (id, data) => api.post(`/hr/team/${id}/update-salary/`, data),
  updatePermissions: (id, data) => api.post(`/hr/team/${id}/update-permissions/`, data),
  getTeamDocuments: (id) => api.get(`/hr/team/${id}/documents/`),
  uploadTeamDocument: (id, formData) =>
    api.post(`/hr/team/${id}/upload-document/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Invites
  getInvites: (params) => api.get('/hr/invites/', { params }),
  createInvite: (data, params) => api.post('/hr/invites/', data, { params }),
  deleteInvite: (id) => api.delete(`/hr/invites/${id}/`),
  resendInvite: (id) => api.post(`/hr/invites/${id}/resend/`),
  verifyInvite: (code) => api.get('/hr/accept-invite/', { params: { code } }),
  acceptInvite: (data) => api.post('/hr/accept-invite/', data),

  // Document Templates
  getDocumentTemplates: () => api.get('/hr/document-templates/'),
  createDocumentTemplate: (formData) =>
    api.post('/hr/document-templates/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteDocumentTemplate: (id) => api.delete(`/hr/document-templates/${id}/`),
  extractPlaceholders: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/hr/document-templates/extract_placeholders/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  fixPlaceholders: (file, mappings) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mappings', JSON.stringify(mappings))
    return api.post('/hr/document-templates/fix_placeholders/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
    })
  },

  // Training Modules
  getTrainingModules: () => api.get('/hr/training-modules/'),
  createTrainingModule: (formData) =>
    api.post('/hr/training-modules/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateTrainingModule: (id, formData) =>
    api.patch(`/hr/training-modules/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteTrainingModule: (id) => api.delete(`/hr/training-modules/${id}/`),

  // IR330
  submitIR330: (data) => api.post('/hr/ir330/', data),

  // Bank Account
  saveBankAccount: (data) => api.post('/hr/save-bank-account/', data),

  // Onboarding
  getOnboardings: (params) => api.get('/hr/onboardings/', { params }),
  getOnboarding: (id) => api.get(`/hr/onboardings/${id}/`),
  completeOnboarding: (id) => api.post(`/hr/onboardings/${id}/complete/`),
  completeOnboardingTask: (id) => api.post(`/hr/onboarding-tasks/${id}/complete/`),
  incompleteOnboardingTask: (id) => api.post(`/hr/onboarding-tasks/${id}/incomplete/`),
  updateOnboardingTask: (id, formData) =>
    api.patch(`/hr/onboarding-tasks/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  signDocument: (id, data) => api.post(`/hr/documents/${id}/sign/`, data),
  previewDocument: (id) => api.get(`/hr/documents/${id}/preview/`, { responseType: 'blob' }),
  documentPages: (id) => api.get(`/hr/documents/${id}/pages/`),
  downloadDocument: (id) => api.get(`/hr/documents/${id}/download/`, { responseType: 'blob' }),

  // Password Reset (manager)
  resetPassword: (id) => api.post(`/hr/team/${id}/reset-password/`),

  // Shift Templates
  getShiftTemplates: () => api.get('/hr/shift-templates/'),
  createShiftTemplate: (data) => api.post('/hr/shift-templates/', data),
  updateShiftTemplate: (id, data) => api.patch(`/hr/shift-templates/${id}/`, data),
  deleteShiftTemplate: (id) => api.delete(`/hr/shift-templates/${id}/`),

  // Copy Week Roster
  copyWeekRoster: (sourceDate, targetDate) =>
    api.post('/hr/rosters/copy-week/', { source_date: sourceDate, target_date: targetDate }),

  // My Documents (employee's own)
  getMyDocuments: () => api.get('/hr/documents/my-documents/'),

  // Inquiries
  getInquiries: () => api.get('/hr/inquiries/'),
  createInquiry: (data) => api.post('/hr/inquiries/', data),
  replyInquiry: (id, data) => api.post(`/hr/inquiries/${id}/reply/`, data),
  closeInquiry: (id) => api.post(`/hr/inquiries/${id}/close/`),

  // Resignation
  getResignationRequests: () => api.get('/hr/resignation-requests/'),
  createResignation: (data) => api.post('/hr/resignation-requests/', data),
  confirmResignation: (id, data) => api.post(`/hr/resignation-requests/${id}/confirm/`, data),
  withdrawResignation: (id) => api.post(`/hr/resignation-requests/${id}/withdraw/`),
}

// Store Settings API
export const storeAPI = {
  // Organization 설정
  getSettings: (params) => api.get('/users/organization/settings/', { params }),
  updateSettings: (data, params) => api.patch('/users/organization/settings/', data, { params }),
  updateSettingsWithFile: (formData, params) =>
    api.patch('/users/organization/settings/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params,
    }),

  // Suppliers
  getSuppliers: (params) => api.get('/closing/suppliers/', { params }),
  createSupplier: (data, params) => api.post('/closing/suppliers/', data, { params }),
  updateSupplier: (id, data) => api.patch(`/closing/suppliers/${id}/`, data),
  deleteSupplier: (id) => api.delete(`/closing/suppliers/${id}/`),

  // Sales Categories
  getSalesCategories: (params) => api.get('/closing/sales-categories/', { params }),
  createSalesCategory: (data, params) => api.post('/closing/sales-categories/', data, { params }),
  updateSalesCategory: (id, data) => api.patch(`/closing/sales-categories/${id}/`, data),
  deleteSalesCategory: (id) => api.delete(`/closing/sales-categories/${id}/`),

  // Job Titles
  getJobTitles: (params) => api.get('/users/job-titles/', { params }),
  createJobTitle: (data, params) => api.post('/users/job-titles/', data, { params }),
  updateJobTitle: (id, data) => api.patch(`/users/job-titles/${id}/`, data),
  deleteJobTitle: (id) => api.delete(`/users/job-titles/${id}/`),

  // Integrations
  getIntegrations: () => api.get('/users/integrations/'),
  connectIntegration: (service, data) => api.post(`/users/integrations/${service}/connect/`, data),
  disconnectIntegration: (service) => api.post(`/users/integrations/${service}/disconnect/`),
  testIntegration: (service) => api.post(`/users/integrations/${service}/test/`),
  syncIntegration: (service, data) => api.post(`/users/integrations/${service}/sync/`, data || {}, { timeout: 60000 }),
  selectStore: (service, data) => api.post(`/users/integrations/${service}/store-select/`, data),
}

// Safety Settings API
export const safetyAPI = {
  // Checklist Templates
  getTemplates: () => api.get('/safety/checklist-templates/'),
  createTemplate: (data) => api.post('/safety/checklist-templates/', data),
  updateTemplate: (id, data) => api.patch(`/safety/checklist-templates/${id}/`, data),
  deleteTemplate: (id) => api.delete(`/safety/checklist-templates/${id}/`),

  // Temperature Locations
  getTemperatureLocations: (params) => api.get('/safety/temperature-locations/', { params }),
  createTemperatureLocation: (data, params) => api.post('/safety/temperature-locations/', data, { params }),
  updateTemperatureLocation: (id, data) => api.patch(`/safety/temperature-locations/${id}/`, data),
  deleteTemperatureLocation: (id) => api.delete(`/safety/temperature-locations/${id}/`),

  // Cleaning Areas
  getCleaningAreas: (params) => api.get('/safety/cleaning-areas/', { params }),
  createCleaningArea: (data, params) => api.post('/safety/cleaning-areas/', data, { params }),
  updateCleaningArea: (id, data) => api.patch(`/safety/cleaning-areas/${id}/`, data),
  deleteCleaningArea: (id) => api.delete(`/safety/cleaning-areas/${id}/`),

  // Temperature Records
  createTemperatureRecord: (data, params) => api.post('/safety/temperatures/', data, { params }),

  // MPI Record Types (카탈로그)
  getRecordTypes: (params) => api.get('/safety/record-types/', { params }),

  // Store Record Configs (매장별 on/off)
  getRecordConfigs: () => api.get('/safety/record-configs/'),
  initializeConfigs: () => api.post('/safety/record-configs/initialize/'),
  toggleConfig: (id) => api.post(`/safety/record-configs/${id}/toggle/`),
  updateConfig: (id, data) => api.patch(`/safety/record-configs/${id}/`, data),

  // Safety Records (기록)
  getRecords: (params) => api.get('/safety/records/', { params }),
  createRecord: (data) => api.post('/safety/records/', data),
  getRecord: (id) => api.get(`/safety/records/${id}/`),
  updateRecord: (id, data) => api.patch(`/safety/records/${id}/`, data),

  // Custom Actions
  getTodayTasks: (params) => api.get('/safety/records/today_tasks/', { params }),
  quickComplete: (data, params) => api.post('/safety/records/quick_complete/', data, { params }),
  reviewRecord: (id, data) => api.post(`/safety/records/${id}/review/`, data),
  getInspectionReport: (params) => api.get('/safety/records/inspection_report/', { params }),
  getWeeklySummary: () => api.get('/safety/records/weekly_summary/'),
}

// Payroll 관련 API
export const payrollAPI = {
  // Pay Periods
  getPayPeriods: (params) => api.get('/payroll/pay-periods/', { params }),
  createPayPeriod: (data) => api.post('/payroll/pay-periods/', data),
  updatePayPeriod: (id, data) => api.patch(`/payroll/pay-periods/${id}/`, data),
  generatePayslips: (id) => api.post(`/payroll/pay-periods/${id}/generate_payslips/`),
  finalizePayPeriod: (id) => api.post(`/payroll/pay-periods/${id}/finalize/`),

  // Payslips
  getPayslips: (params) => api.get('/payroll/payslips/', { params }),
  getPayslip: (id) => api.get(`/payroll/payslips/${id}/`),
  getPayslipSummary: (id) => api.get(`/payroll/payslips/${id}/summary/`),
  getMyPayslips: () => api.get('/payroll/payslips/my_payslips/'),
  calculatePayslip: (id) => api.post(`/payroll/payslips/${id}/calculate/`),
  getPeriodSummary: (payPeriodId) => api.get('/payroll/payslips/period_summary/', { params: { pay_period_id: payPeriodId } }),

  // Salaries
  getSalaries: (params) => api.get('/payroll/salaries/', { params }),
  getActiveSalaries: () => api.get('/payroll/salaries/active/'),
  createSalary: (data) => api.post('/payroll/salaries/', data),
  updateSalary: (id, data) => api.patch(`/payroll/salaries/${id}/`, data),

  // Leave
  getLeaveBalances: (params) => api.get('/payroll/leave-balances/', { params }),
  getMyLeaveBalances: (params) => api.get('/payroll/leave-balances/my_balances/', { params }),
  initializeLeaveBalances: (data) => api.post('/payroll/leave-balances/initialize/', data),
  getLeaveRequests: (params) => api.get('/payroll/leave-requests/', { params }),
  getMyLeaveRequests: () => api.get('/payroll/leave-requests/my_requests/'),
  createLeaveRequest: (data) => {
    if (data instanceof FormData) {
      return api.post('/payroll/leave-requests/', data, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
    return api.post('/payroll/leave-requests/', data)
  },
  approveLeave: (id) => api.post(`/payroll/leave-requests/${id}/approve/`),
  declineLeave: (id, data) => api.post(`/payroll/leave-requests/${id}/decline/`, data),
  cancelLeave: (id) => api.post(`/payroll/leave-requests/${id}/cancel/`),

  // Public Holidays
  getPublicHolidays: (params) => api.get('/payroll/public-holidays/', { params }),
  generatePublicHolidays: (data) => api.post('/payroll/public-holidays/generate/', data),

  // PayDay Filing
  getFilings: (params) => api.get('/payroll/payday-filing/', { params }),
  generateFiling: (id) => api.post(`/payroll/payday-filing/${id}/generate/`),
  downloadFiling: (id) => api.get(`/payroll/payday-filing/${id}/download/`, { responseType: 'blob' }),
  markFiled: (id, data) => api.post(`/payroll/payday-filing/${id}/mark_filed/`, data),
}

// 리포트 관련 API
export const reportsAPI = {
  // 일일 매장 리포트
  getDailyStoreReport: (date) =>
    api.get('/reports/daily_store_report/', { params: { date } }),

  // 매장 간 비교
  getStoreComparison: (date) =>
    api.get('/reports/store_comparison/', { params: { date } }),

  // 매출 성과 (legacy)
  getSalesPerformance: (period = 'daily', days = 30) =>
    api.get('/reports/sales_performance/', { params: { period, days } }),

  // Cash Report — 단일 날짜
  getCashReport: (date) =>
    api.get('/reports/cash_report/', { params: { date } }),

  // Cash Report — 기간
  getCashReportRange: (startDate, endDate) =>
    api.get('/reports/cash_report/', {
      params: { start_date: startDate, end_date: endDate },
    }),

  // Supply Report
  getSupplyReport: (period, params) =>
    api.get('/reports/supply_report/', { params: { period, ...params } }),

  // Supply Detail — drill-down for a supplier in a month
  getSupplyDetail: (supplierId, month) =>
    api.get('/reports/supply_detail/', { params: { supplier_id: supplierId, month } }),

  // Sales Report — 단일 날짜
  getSalesReportByDate: (date) =>
    api.get('/reports/sales_report/', { params: { date } }),

  // Sales Report — 기간
  getSalesReportRange: (startDate, endDate) =>
    api.get('/reports/sales_report/', {
      params: { start_date: startDate, end_date: endDate },
    }),

  // Sales Report (legacy)
  getSalesReport: (period, days) =>
    api.get('/reports/sales_report/', { params: { period, days } }),

  // HR Cash Report — 단일 날짜
  getHRCashReport: (date) =>
    api.get('/reports/hr_cash_report/', { params: { date } }),

  // HR Cash Report — 기간
  getHRCashReportRange: (startDate, endDate) =>
    api.get('/reports/hr_cash_report/', {
      params: { start_date: startDate, end_date: endDate },
    }),

  // Chart Data (Sales/QTY/Labour/COGS + YoY)
  getChartData: (startDate, endDate) =>
    api.get('/reports/chart_data/', {
      params: { start_date: startDate, end_date: endDate },
    }),

  // Multi-store sales comparison
  getMultiStoreSales: (startDate, endDate, storeIds) =>
    api.get('/reports/multi_store_sales/', {
      params: { start_date: startDate, end_date: endDate, store_ids: storeIds?.join(',') },
    }),

  // AI Insights
  getAIInsights: (startDate, endDate, storeId) =>
    api.get('/reports/ai_insights/', {
      params: { start_date: startDate, end_date: endDate, store_id: storeId },
      timeout: 60000,
    }),
}

// Other Sales API (기타 매출)
export const otherSalesAPI = {
  list: (closingId) =>
    api.get('/closing/other-sales/', { params: { closing_id: closingId } }),
  create: (data) => api.post('/closing/other-sales/', data),
  delete: (id) => api.delete(`/closing/other-sales/${id}/`),
}

// Supplier Cost API
export const supplierCostAPI = {
  list: (closingIdOrParams) =>
    typeof closingIdOrParams === 'object'
      ? api.get('/closing/supplier-costs/', { params: closingIdOrParams })
      : api.get('/closing/supplier-costs/', { params: { closing_id: closingIdOrParams } }),
  create: (data) => api.post('/closing/supplier-costs/', data),
  update: (id, data) => api.patch(`/closing/supplier-costs/${id}/`, data),
  delete: (id) => api.delete(`/closing/supplier-costs/${id}/`),
}

// Supplier Statement API
export const supplierStatementAPI = {
  list: (params) => api.get('/closing/supplier-statements/', { params }),
  upload: (formData) =>
    api.post('/closing/supplier-statements/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // Vision API parsing may take time
    }),
  reconcile: (id) =>
    api.post(`/closing/supplier-statements/${id}/reconcile/`),
  comparison: (id) =>
    api.get(`/closing/supplier-statements/${id}/comparison/`),
}

// CQ Report API
export const cqAPI = {
  getBalances: () => api.get('/closing/cq-balance/'),
  updateBalance: (data) => api.post('/closing/cq-balance/update-balance/', data),
  listExpenses: (params) => api.get('/closing/cq-expenses/', { params }),
  createExpense: (formData) =>
    api.post('/closing/cq-expenses/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  approveExpense: (id) => api.post(`/closing/cq-expenses/${id}/approve/`),
  deleteExpense: (id) => api.delete(`/closing/cq-expenses/${id}/`),
  combinedLedger: (params) => api.get('/closing/cq-expenses/combined-ledger/', { params }),
}

// Sales Analysis API (역할별 매출 분석)
export const salesAnalysisAPI = {
  getStoreAnalysis: (params) => api.get('/closing/sales-analysis/store/', { params }),
  getRegionalAnalysis: (params) => api.get('/closing/sales-analysis/regional/', { params }),
  getEnterpriseAnalysis: (params) => api.get('/closing/sales-analysis/enterprise/', { params }),
  getAccessibleStores: () => api.get('/closing/sales-analysis/stores/'),
  getAIInsights: (params) => api.get('/closing/sales-analysis/ai-insights/', { params, timeout: 60000 }),
  getComparison: (params) => api.get('/closing/sales-analysis/compare/', { params }),
  getHolidays: (params) => api.get('/closing/sales-analysis/holidays/', { params }),
}

// Monthly Close API
export const monthlyCloseAPI = {
  summary: (year, month) =>
    api.get('/closing/monthly-close/summary/', { params: { year, month } }),
  closeMonth: (data) =>
    api.post('/closing/monthly-close/close-month/', data),
  reopen: (data) =>
    api.post('/closing/monthly-close/reopen/', data),
}

// Admin API (CEO/HQ — Store Applications & Store Assignment)
export const adminAPI = {
  getStoreApplications: (params) => api.get('/users/store-applications/', { params }),
  approveApplication: (id, data) => api.post(`/users/store-applications/${id}/approve/`, data || {}),
  rejectApplication: (id, data) => api.post(`/users/store-applications/${id}/reject/`, data || {}),
  submitStoreApplication: (data) => api.post('/auth/store-application/', data),
  getManagerStores: () => api.get('/users/assign-stores/'),
  assignStores: (userId, storeIds) => api.post('/users/assign-stores/', { user_id: userId, store_ids: storeIds }),
  updateUserRole: (userId, role, storeIds) => api.post('/users/assign-stores/', { user_id: userId, role, store_ids: storeIds || [] }),
}

export const skyReportAPI = {
  list: (params) => api.get('/reports/sky-reports/', { params }),
  get: (id) => api.get(`/reports/sky-reports/${id}/`),
  create: (data) => api.post('/reports/sky-reports/', data),
  update: (id, data) => api.put(`/reports/sky-reports/${id}/`, data),
  patch: (id, data) => api.patch(`/reports/sky-reports/${id}/`, data),
  delete: (id) => api.delete(`/reports/sky-reports/${id}/`),
  summary: (year) => api.get('/reports/sky-reports/summary/', { params: { year } }),
  downloadTemplate: () => api.get('/reports/sky-reports/template/', { responseType: 'blob' }),
  upload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/reports/sky-reports/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

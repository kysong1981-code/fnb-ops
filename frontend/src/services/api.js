import axios from 'axios'

// API base URL 설정
const API_BASE_URL = 'http://localhost:8000/api'

// axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - JWT 토큰 자동 추가
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - 401 에러 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 토큰 만료 또는 무효
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// API 함수들 (필요에 따라 추가)
export const authAPI = {
  // 로그인
  login: (username, password) =>
    api.post('/auth/token/', { username, password }),

  // 회원가입
  register: (userData) => api.post('/auth/register/', userData),

  // 프로필 조회
  getProfile: () => api.get('/auth/profile/'),

  // 권한 확인
  checkPermission: (resource, action) =>
    api.post('/auth/check-permission/', { resource, action }),
}

// 클로징 관련 API (향후)
export const closingAPI = {
  // 클로징 목록
  list: () => api.get('/closing/'),

  // 클로징 생성
  create: (data) => api.post('/closing/', data),

  // 클로징 상세 조회
  get: (id) => api.get(`/closing/${id}/`),

  // 클로징 업데이트
  update: (id, data) => api.put(`/closing/${id}/`, data),
}

// 매출 관련 API (향후)
export const salesAPI = {
  list: () => api.get('/sales/'),
  get: (id) => api.get(`/sales/${id}/`),
}

// HR 관련 API (향후)
export const hrAPI = {
  roster: () => api.get('/hr/roster/'),
  timesheet: () => api.get('/hr/timesheet/'),
}

import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

// Context 생성
const AuthContext = createContext()

// AuthProvider 컴포넌트
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 초기화: localStorage에서 토큰 복원
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token')
    if (storedToken) {
      setToken(storedToken)
      // 토큰이 유효한지 확인하기 위해 프로필 조회
      fetchUserProfile(storedToken)
    } else {
      setLoading(false)
    }
  }, [])

  // 사용자 프로필 조회
  const fetchUserProfile = async (accessToken) => {
    try {
      const response = await api.get('/auth/profile/', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      setUser(response.data.profile)
      setError(null)
    } catch (err) {
      console.error('프로필 조회 실패:', err)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // 로그인
  const login = async (username, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/auth/token/', {
        username,
        password,
      })

      const { access, refresh } = response.data

      // 토큰 저장
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
      setToken(access)

      // 프로필 조회
      await fetchUserProfile(access)

      return { success: true }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || '로그인 실패'
      setError(errorMsg)
      console.error('로그인 에러:', err)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  // 회원가입
  const register = async (userData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/auth/register/', userData)

      // 회원가입 후 자동 로그인
      return await login(userData.username, userData.password)
    } catch (err) {
      const errorMsg = err.response?.data?.error || '회원가입 실패'
      setError(errorMsg)
      console.error('회원가입 에러:', err)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  // 로그아웃
  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setToken(null)
    setUser(null)
    setError(null)
  }

  // 권한 확인
  const hasPermission = async (resource, action) => {
    if (!token) return false

    try {
      const response = await api.post(
        '/auth/check-permission/',
        { resource, action },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      return response.data.has_permission
    } catch (err) {
      console.error('권한 확인 실패:', err)
      return false
    }
  }

  const value = {
    user,
    token,
    loading,
    error,
    login,
    register,
    logout,
    hasPermission,
    isAuthenticated: !!token && !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// useAuth Hook
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

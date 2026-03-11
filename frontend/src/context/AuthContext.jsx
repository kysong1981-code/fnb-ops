import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

// Create Context
const AuthContext = createContext()

// AuthProvider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialization: restore token from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token')
    if (storedToken) {
      setToken(storedToken)
      // Fetch profile to verify token validity
      fetchUserProfile(storedToken)
    } else {
      setLoading(false)
    }
  }, [])

  // Fetch user profile
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
      console.error('Failed to fetch profile:', err)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // Login (email-based)
  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/auth/token/', {
        email,
        password,
      })

      const { access, refresh } = response.data

      // Save tokens
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
      setToken(access)

      // Attempt to fetch profile (ignore if it fails)
      try {
        await fetchUserProfile(access)
      } catch (profileErr) {
        console.warn('Failed to fetch profile (ignoring and continuing):', profileErr)
        setLoading(false)
      }

      return { success: true }
    } catch (err) {
      const errData = err.response?.data
      const errorMsg = errData?.detail || errData?.non_field_errors?.[0] || (Array.isArray(errData) ? errData[0] : null) || 'Login failed'
      setError(errorMsg)
      console.error('Login error:', err)
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

      // Auto-login after registration
      return await login(userData.username, userData.password)
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Registration failed'
      setError(errorMsg)
      console.error('Registration error:', err)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  // Logout
  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setToken(null)
    setUser(null)
    setError(null)
  }

  // Refresh user profile (e.g. after settings change)
  const refreshProfile = async () => {
    const storedToken = localStorage.getItem('access_token')
    if (storedToken) {
      await fetchUserProfile(storedToken)
    }
  }

  // Check if a feature module is enabled for this organization
  const isModuleEnabled = (moduleKey) => {
    const modules = user?.organization_detail?.enabled_modules
    if (!modules || modules.length === 0) return true  // fallback: all enabled
    return modules.includes(moduleKey)
  }

  // Check permissions
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
      console.error('Permission check failed:', err)
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
    isModuleEnabled,
    refreshProfile,
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

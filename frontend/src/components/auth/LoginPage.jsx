import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const autoLoginAttempted = useRef(false)

  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()

  // Auto-login: automatically log in with demo credentials in development
  useEffect(() => {
    if (autoLoginAttempted.current) return
    if (isAuthenticated) {
      navigate('/dashboard')
      return
    }
    autoLoginAttempted.current = true
    const doAutoLogin = async () => {
      setIsLoading(true)
      try {
        const result = await login('admin@test.com', 'admin123')
        if (result.success) {
          navigate('/dashboard')
        }
      } catch (err) {
        console.error('Auto-login failed:', err)
      } finally {
        setIsLoading(false)
      }
    }
    doAutoLogin()
  }, [isAuthenticated, login, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await login(email, password)
      if (result.success) {
        navigate('/dashboard')
      } else {
        setError(result.error || 'Login failed')
      }
    } catch (err) {
      setError('An error occurred during login')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Oneops</h1>
          <p className="text-gray-500 text-sm">Food & Beverage Management System</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-2xl hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed mt-6"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Get Started Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 mb-1">Want to open a new store?</p>
          <button
            type="button"
            onClick={() => navigate('/get-started')}
            className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
          >
            Get Started
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Demo account:</p>
          <p className="font-mono text-xs mt-2 bg-gray-50 border border-gray-100 p-2 rounded-xl">
            admin@test.com / admin123
          </p>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { hrAPI } from '../../services/api'

export default function AcceptInvite() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()

  const [inviteInfo, setInviteInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activating, setActivating] = useState(false)
  const [activated, setActivated] = useState(false)

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await hrAPI.verifyInvite(inviteCode)
        setInviteInfo(res.data)
      } catch (err) {
        setError(err.response?.data?.error || 'Invalid or expired invite link')
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [inviteCode])

  const handleActivate = async () => {
    setError('')
    setActivating(true)
    try {
      const res = await hrAPI.acceptInvite({ invite_code: inviteCode })

      // Auto-login with JWT
      localStorage.setItem('access_token', res.data.access)
      localStorage.setItem('refresh_token', res.data.refresh)

      setActivated(true)

      // Redirect to onboarding if available, otherwise dashboard
      const target = res.data.onboarding_id
        ? `/hr/onboarding/${res.data.onboarding_id}`
        : '/dashboard'
      setTimeout(() => {
        window.location.href = target
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to activate account')
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!inviteInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Invalid Invite</h1>
          <p className="text-sm text-gray-500 mb-6">{error || 'This invite link is invalid or has expired.'}</p>
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (activated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">&#10003;</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Account Activated!</h1>
          <p className="text-sm text-gray-500">Redirecting to onboarding...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
          <p className="text-sm text-gray-500 mt-1">
            You have been invited to join <span className="font-semibold text-gray-900">{inviteInfo.organization_name}</span>
          </p>
        </div>

        {/* Invite Info Card */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-blue-600 font-medium">Name</span>
              <p className="text-gray-900 font-semibold">{inviteInfo.first_name} {inviteInfo.last_name}</p>
            </div>
            <div>
              <span className="text-xs text-blue-600 font-medium">Role</span>
              <p className="text-gray-900 font-semibold">{inviteInfo.role}</p>
            </div>
            <div>
              <span className="text-xs text-blue-600 font-medium">Position</span>
              <p className="text-gray-900 font-semibold">{inviteInfo.job_title}</p>
            </div>
            <div>
              <span className="text-xs text-blue-600 font-medium">Organization</span>
              <p className="text-gray-900 font-semibold">{inviteInfo.organization_name}</p>
            </div>
          </div>
        </div>

        {/* Activation Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Activate Your Account</h2>
          <p className="text-xs text-gray-400 mb-5">
            Click the button below to activate your account. Use the temporary password provided by your manager to log in.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">{error}</div>
          )}

          <button
            onClick={handleActivate}
            disabled={activating}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {activating ? 'Activating...' : 'Activate Account'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            After activation, log in with your email and the temporary password from your manager.
          </p>
        </div>
      </div>
    </div>
  )
}

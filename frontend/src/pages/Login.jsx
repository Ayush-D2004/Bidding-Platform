import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuctionStore from '../store/auctionStore'

const ROLES = [
  {
    id: 'auctioneer',
    label: 'Chief Auctioneer',
    username: 'auctioneer',
    role: 'AUCTIONEER',
    icon: '🎤',
    description: 'Control the auction floor. Start bids, accept or reject offers, get AI copilot analysis.',
    gradient: 'from-amber-500/20 to-yellow-600/10',
    border: 'border-amber-500/40',
    glow: 'hover:shadow-amber-500/20',
  },
  {
    id: 'mumbai',
    label: 'Mumbai Mavericks',
    username: 'mumbai',
    role: 'TEAM_MANAGER',
    icon: '🔵',
    description: 'Represent Mumbai Mavericks. Place bids, track roster, analyse synergy.',
    gradient: 'from-blue-500/20 to-blue-700/10',
    border: 'border-blue-500/40',
    glow: 'hover:shadow-blue-500/20',
  },
  {
    id: 'delhi',
    label: 'Delhi Dynamos',
    username: 'delhi',
    role: 'TEAM_MANAGER',
    icon: '🟣',
    description: 'Represent Delhi Dynamos. Build a title-winning squad within budget.',
    gradient: 'from-purple-500/20 to-purple-700/10',
    border: 'border-purple-500/40',
    glow: 'hover:shadow-purple-500/20',
  },
  {
    id: 'pune',
    label: 'Pune Panthers',
    username: 'pune',
    role: 'TEAM_MANAGER',
    icon: '🟢',
    description: 'Represent Pune Panthers. Dominate the auction with smart bidding.',
    gradient: 'from-emerald-500/20 to-emerald-700/10',
    border: 'border-emerald-500/40',
    glow: 'hover:shadow-emerald-500/20',
  },
  {
    id: 'chennai',
    label: 'Chennai Challengers',
    username: 'chennai',
    role: 'TEAM_MANAGER',
    icon: '🟡',
    description: 'Represent Chennai Challengers. Acquire legends and forge a dynasty.',
    gradient: 'from-yellow-500/20 to-orange-600/10',
    border: 'border-yellow-500/40',
    glow: 'hover:shadow-yellow-500/20',
  },
]

export default function Login() {
  const login = useAuctionStore((s) => s.login)
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!selected) return
    setLoading(true)
    setError('')
    try {
      const user = await login(selected.username, 'npl2024')
      if (user.role === 'AUCTIONEER') navigate('/auctioneer')
      else navigate('/manager')
    } catch (e) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-[-20%] left-[10%] w-96 h-96 bg-accent-gold/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[5%] w-80 h-80 bg-accent-blue/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-gold/20 border border-accent-gold/40 flex items-center justify-center text-2xl">
            🏏
          </div>
          <h1 className="text-4xl font-black tracking-tight text-text-primary">
            NPL <span className="text-accent-gold">Auction</span>
          </h1>
        </div>
        <p className="text-text-muted text-lg">National Premier League · Season 2024</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
          <span className="text-accent-emerald text-sm font-medium">Live Platform Active</span>
        </div>
      </div>

      {/* Role selector */}
      <div className="w-full max-w-4xl animate-slide-up">
        <h2 className="text-center text-text-secondary text-sm font-semibold uppercase tracking-widest mb-6">
          Select your role to enter the auction room
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelected(role)}
              className={`
                relative group text-left p-5 rounded-2xl border transition-all duration-300
                bg-gradient-to-br ${role.gradient} ${role.border}
                hover:scale-105 hover:shadow-2xl ${role.glow}
                ${selected?.id === role.id
                  ? 'ring-2 ring-accent-gold scale-105 shadow-2xl shadow-accent-gold/20'
                  : 'hover:border-opacity-80'
                }
              `}
            >
              {selected?.id === role.id && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent-gold flex items-center justify-center">
                  <svg className="w-3 h-3 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <div className="text-3xl mb-3">{role.icon}</div>
              <div className="font-bold text-text-primary text-sm mb-1">{role.label}</div>
              <div className="text-text-muted text-xs leading-relaxed">{role.description}</div>
              {role.role === 'AUCTIONEER' && (
                <div className="mt-3 inline-flex items-center gap-1.5 bg-accent-gold/20 text-accent-gold text-xs px-2 py-0.5 rounded-full font-medium">
                  <span>AI Copilot</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Enter button */}
      <div className="mt-8 flex flex-col items-center gap-3 animate-fade-in">
        {error && (
          <div className="text-accent-red text-sm bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}
        <button
          onClick={handleLogin}
          disabled={!selected || loading}
          className={`
            px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-300
            ${selected && !loading
              ? 'bg-accent-gold text-gray-900 hover:bg-yellow-400 hover:scale-105 shadow-2xl shadow-accent-gold/30 active:scale-95'
              : 'bg-surface-2 text-text-muted cursor-not-allowed border border-border-dark'
            }
          `}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Entering…
            </span>
          ) : selected ? (
            `Enter as ${selected.label} →`
          ) : (
            'Select a role to continue'
          )}
        </button>
        <p className="text-text-muted text-xs">All accounts use password: <code className="text-accent-gold">npl2024</code></p>
      </div>
    </div>
  )
}

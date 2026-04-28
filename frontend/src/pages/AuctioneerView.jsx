import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useAuctionStore from '../store/auctionStore'
import PlayerCard from '../components/PlayerCard'
import BidVelocityChart from '../components/BidVelocityChart'
import CopilotPanel from '../components/CopilotPanel'
import AuctionLog from '../components/AuctionLog'

export default function AuctioneerView() {
  const navigate = useNavigate()
  const {
    user, token, logout,
    currentAuction, bids, connectionStatus,
    copilotAnalysis, copilotLoading,
    players, fetchPlayers, fetchActiveAuction,
    startAuction, acceptBid, rejectBid, requestCopilot,
    connect, auctionId, notification, clearNotification,
  } = useAuctionStore()

  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!token || user?.role !== 'AUCTIONEER') {
      navigate('/')
      return
    }
    fetchPlayers()
    fetchActiveAuction().then((auction) => {
      if (auction?.auction_id) connect(auction.auction_id)
    })
  }, [])

  const handleStartAuction = async () => {
    if (!selectedPlayerId) return
    setStarting(true)
    try {
      await startAuction(selectedPlayerId)
    } finally {
      setStarting(false)
    }
  }

  const handleReject = () => {
    rejectBid(rejectReason)
    setShowRejectModal(false)
    setRejectReason('')
  }

  const auction = currentAuction
  const player = auction?.player
  const valuation = auction?.valuation
  const events = auction?.events || []
  const statusActive = auction?.status === 'ACTIVE'

  const availablePlayers = players.filter((p) => p.status === 'AVAILABLE' || p.status === 'ON_AUCTION')

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary">
      {/* ── Top Nav ── */}
      <nav className="border-b border-border-dark bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎤</span>
            <div>
              <h1 className="font-black text-text-primary leading-none">Auctioneer Command</h1>
              <p className="text-text-muted text-xs">NPL Season-1 @2026</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection badge */}
            <div className="flex items-center gap-2 bg-surface-2 border border-border-dark rounded-full px-3 py-1.5">
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-accent-emerald animate-pulse' :
                connectionStatus === 'connecting' ? 'bg-accent-gold animate-pulse' : 'bg-accent-red'
              }`} />
              <span className="text-xs text-text-secondary capitalize">{connectionStatus}</span>
            </div>

            <button onClick={logout} className="btn-ghost text-sm">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Notification toast ── */}
      {notification && (
        <div
          onClick={clearNotification}
          className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl border cursor-pointer animate-slide-up text-sm font-medium max-w-sm ${
            notification.type === 'bid' ? 'bg-accent-gold/20 border-accent-gold/40 text-accent-gold' :
            notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
            notification.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-400' :
            'bg-surface-2 border-border-dark text-text-primary'
          }`}
        >
          {notification.message}
        </div>
      )}

      <main className="max-w-screen-2xl mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* ── LEFT: Player + Controls ── */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="col-span-12 lg:col-span-4 space-y-5"
        >
          {/* Player selector */}
          <div className="card">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
              🎯 Start New Auction
            </h2>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="input-dark w-full mb-3"
              id="player-selector"
            >
              <option value="">Select a player…</option>
              {availablePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{(p.base_price / 100000).toFixed(0)}L ({p.skill_type})
                </option>
              ))}
            </select>
            <button
              id="start-auction-btn"
              onClick={handleStartAuction}
              disabled={!selectedPlayerId || starting}
              className={`w-full py-3 rounded-xl font-bold transition-all duration-200 ${
                selectedPlayerId && !starting
                  ? 'bg-accent-gold text-gray-900 hover:bg-yellow-400'
                  : 'bg-surface-2 text-text-muted cursor-not-allowed'
              }`}
            >
              {starting ? '⏳ Starting…' : '🚀 Start Auction'}
            </button>
          </div>

          {/* Current player card */}
          {player ? (
            <PlayerCard
              player={player}
              currentBid={auction?.current_bid}
              fairValue={valuation?.fair_value}
            />
          ) : (
            <div className="card text-center py-10">
              <div className="text-4xl mb-3">🏏</div>
              <p className="text-text-muted">No active auction</p>
            </div>
          )}

          {/* Auction stats */}
          {statusActive && (
            <div className="card space-y-3">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Live Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Current Bid" value={auction?.current_bid ? `₹${(auction.current_bid / 100000).toFixed(1)}L` : '—'} accent />
                <StatBox label="Total Bids" value={bids.length} />
                <StatBox label="Leading" value={auction?.current_bidder || '—'} />
                <StatBox label="Fair Value" value={valuation ? `₹${(valuation.fair_value / 100000).toFixed(1)}L` : '—'} />
              </div>
            </div>
          )}

          {/* Closed auction summary */}
          {auction?.status === 'CLOSED' && (
            <div className="card border-accent-gold/30 bg-accent-gold/5">
              <h3 className="text-accent-gold font-bold mb-3">🏆 Auction Closed</h3>
              <p className="text-text-secondary text-sm">
                Winner: <span className="text-text-primary font-semibold">{auction.winner_team || '—'}</span>
              </p>
              <p className="text-text-secondary text-sm">
                Final: <span className="text-accent-gold font-bold">₹{((auction.final_price || 0) / 100000).toFixed(1)}L</span>
              </p>
            </div>
          )}
        </motion.div>

        {/* ── CENTRE: Bid controls + Chart ── */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-12 lg:col-span-5 space-y-5"
        >
          {/* Accept / Reject buttons */}
          {statusActive && (
            <div className="card">
              <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
                ⚡ Bid Controls
              </h2>
              {auction?.current_bidder ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-surface-2 border border-border-dark rounded-xl px-4 py-3">
                    <div>
                      <p className="text-text-muted text-xs">Highest bid by</p>
                      <p className="text-text-primary font-bold">{auction.current_bidder}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-text-muted text-xs">Amount</p>
                      <p className="text-accent-gold font-black text-xl">
                        ₹{(auction.current_bid / 100000).toFixed(1)}L
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="accept-bid-btn"
                      onClick={acceptBid}
                      className="btn-success w-full flex items-center justify-center gap-2"
                    >
                      <span>✅</span> Accept
                    </button>
                    <button
                      id="reject-bid-btn"
                      onClick={() => setShowRejectModal(true)}
                      className="btn-danger w-full flex items-center justify-center gap-2"
                    >
                      <span>❌</span> Reject
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-text-muted text-sm text-center py-4">Waiting for first bid…</p>
              )}
            </div>
          )}

          {/* Bid velocity chart */}
          <div className="card">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
              📊 Bid Velocity (60s Window)
            </h2>
            <BidVelocityChart bids={bids} fairValue={valuation?.fair_value} />
          </div>

          {/* Event log */}
          <div className="card">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
              📋 Auction Log
            </h2>
            <AuctionLog events={events} />
          </div>
        </motion.div>

        {/* ── RIGHT: AI Copilot ── */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-12 lg:col-span-3 space-y-5"
        >
          <div className="card h-fit">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest">
                🤖 AI Copilot
              </h2>
              <span className="text-[10px] bg-accent-gold/20 text-accent-gold border border-accent-gold/30 px-2 py-0.5 rounded-full font-semibold">
                Gemini
              </span>
            </div>
            <CopilotPanel
              analysis={copilotAnalysis}
              loading={copilotLoading}
              onRequest={statusActive ? requestCopilot : null}
            />
          </div>

          {/* Players roster overview */}
          <div className="card">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
              🏟️ Player Pool
            </h2>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    p.status === 'SOLD' ? 'opacity-40' :
                    p.status === 'ON_AUCTION' ? 'bg-accent-gold/10 border border-accent-gold/30' :
                    'bg-surface-2'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    p.status === 'SOLD' ? 'bg-text-muted' :
                    p.status === 'ON_AUCTION' ? 'bg-accent-gold animate-pulse' : 'bg-accent-emerald'
                  }`} />
                  <span className="text-text-primary text-xs font-medium flex-1 truncate">{p.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    p.skill_type === 'batting' ? 'bg-blue-500/20 text-blue-400' :
                    p.skill_type === 'bowling' ? 'bg-teal-500/20 text-teal-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{p.skill_type.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>

      {/* ── Reject modal ── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border-dark rounded-3xl p-8 w-full max-w-sm mx-4 shadow-2xl animate-slide-up">
            <h3 className="text-text-primary font-bold text-lg mb-2">Reject Bid</h3>
            <p className="text-text-muted text-sm mb-4">Optionally provide a reason for rejecting this bid.</p>
            <input
              type="text"
              placeholder="Reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input-dark w-full mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 btn-ghost">Cancel</button>
              <button onClick={handleReject} className="flex-1 btn-danger">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, accent }) {
  return (
    <div className={`rounded-xl p-3 border ${accent ? 'bg-accent-gold/10 border-accent-gold/30' : 'bg-surface-2 border-border-dark'}`}>
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <p className={`font-bold text-lg ${accent ? 'text-accent-gold' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

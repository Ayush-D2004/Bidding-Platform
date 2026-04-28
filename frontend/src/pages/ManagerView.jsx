import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuctionStore from '../store/auctionStore'
import PlayerCard from '../components/PlayerCard'
import ValuationSpread from '../components/ValuationSpread'
import TeamSynergyGraph from '../components/TeamSynergyGraph'
import BidVelocityChart from '../components/BidVelocityChart'
import AuctionLog from '../components/AuctionLog'

const TEAM_NAMES = {
  'team-1': 'Mumbai Mavericks',
  'team-2': 'Delhi Dynamos',
  'team-3': 'Pune Panthers',
  'team-4': 'Chennai Challengers',
}

const BID_INCREMENTS = [500000, 1000000, 2000000, 5000000]

export default function ManagerView() {
  const navigate = useNavigate()
  const {
    user, token, logout,
    currentAuction, bids, connectionStatus,
    roster, budget, teams,
    notification, clearNotification,
    fetchActiveAuction, fetchRoster, fetchTeams,
    placeBid, connect,
  } = useAuctionStore()

  const [customBid, setCustomBid] = useState('')
  const [allRosters, setAllRosters] = useState({})
  const [activeTab, setActiveTab] = useState('auction') // 'auction' | 'roster' | 'synergy'
  const [lastBidKey, setLastBidKey] = useState(0)

  const teamId = user?.team_id
  const teamName = TEAM_NAMES[teamId] || teamId

  useEffect(() => {
    if (!token || user?.role !== 'TEAM_MANAGER') {
      navigate('/')
      return
    }
    fetchRoster()
    fetchTeams()
    fetchActiveAuction().then((auction) => {
      if (auction?.auction_id) connect(auction.auction_id)
    })
  }, [])

  // Re-fetch roster when auction closes
  useEffect(() => {
    if (currentAuction?.status === 'CLOSED') {
      fetchRoster()
    }
  }, [currentAuction?.status])

  // Fetch all rosters for comparison
  useEffect(() => {
    if (teams.length > 0) {
      const fetchAll = async () => {
        const store = useAuctionStore.getState()
        const results = await store.fetchAllRosters()
        setAllRosters(results)
      }
      fetchAll()
    }
  }, [teams.length, currentAuction?.status])

  const auction = currentAuction
  const player = auction?.player
  const valuation = auction?.valuation
  const events = auction?.events || []
  const isActive = auction?.status === 'ACTIVE'
  const myRosterPlayers = roster?.players || []
  const remainingBudget = budget || 50000000
  const totalSpent = roster?.total_spent || 0

  const currentBid = auction?.current_bid || 0
  const basePrice = player?.base_price || 0
  const minNextBid = currentBid > 0 ? currentBid + 100000 : basePrice

  const handleQuickBid = (increment) => {
    const amount = currentBid > 0 ? currentBid + increment : basePrice + increment
    setLastBidKey(Date.now())
    placeBid(amount)
  }

  const handleCustomBid = () => {
    const amount = parseInt(customBid.replace(/[^0-9]/g, '')) * 100000
    if (amount >= minNextBid) {
      placeBid(amount)
      setCustomBid('')
    }
  }

  const isWinning = auction?.current_bidder === teamId
  const budgetPct = Math.max(0, (remainingBudget / 50000000) * 100)

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary">
      {/* ── Nav ── */}
      <nav className="border-b border-border-dark bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-gold/20 border border-accent-gold/40 flex items-center justify-center font-black text-accent-gold">
              {teamName.charAt(0)}
            </div>
            <div>
              <h1 className="font-black text-text-primary leading-none">{teamName}</h1>
              <p className="text-text-muted text-xs">Manager Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-text-muted text-xs">Budget</p>
              <p className="text-accent-gold font-bold">₹{(remainingBudget / 100000).toFixed(0)}L</p>
            </div>
            <div className={`flex items-center gap-2 bg-surface-2 border border-border-dark rounded-full px-3 py-1.5`}>
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-accent-emerald animate-pulse' :
                connectionStatus === 'connecting' ? 'bg-accent-gold animate-pulse' : 'bg-accent-red'
              }`} />
              <span className="text-xs text-text-secondary capitalize">{connectionStatus}</span>
            </div>
            <button onClick={logout} className="btn-ghost text-sm">Sign Out</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-screen-2xl mx-auto px-6 flex gap-1 pb-0">
          {[
            { id: 'auction', label: '⚡ Live Auction' },
            { id: 'roster', label: '👥 My Roster' },
            { id: 'synergy', label: '🔗 Team Synergy' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === tab.id
                  ? 'border-accent-gold text-accent-gold'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Notification ── */}
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

      <div className="max-w-screen-2xl mx-auto px-6 py-6">

        {/* ══ AUCTION TAB ══ */}
        {activeTab === 'auction' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Player + Bid */}
            <div className="col-span-12 lg:col-span-4 space-y-5">
              {/* Winning indicator */}
              {isActive && isWinning && (
                <div className="flex items-center gap-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl px-4 py-3 animate-pulse-slow">
                  <span className="text-xl">🏆</span>
                  <p className="text-emerald-400 font-bold">You're in the lead!</p>
                </div>
              )}

              {player ? (
                <PlayerCard player={player} currentBid={currentBid} fairValue={valuation?.fair_value} />
              ) : (
                <div className="card text-center py-10">
                  <div className="text-4xl mb-3">⏳</div>
                  <p className="text-text-muted">Waiting for auctioneer to start…</p>
                </div>
              )}

              {/* Closed banner */}
              {auction?.status === 'CLOSED' && (
                <div className={`card border-2 ${
                  auction.winner_team === teamId
                    ? 'border-accent-gold/60 bg-accent-gold/10'
                    : 'border-border-dark'
                }`}>
                  <p className="font-bold text-lg mb-1">
                    {auction.winner_team === teamId ? '🏆 You won!' : '📦 Auction Closed'}
                  </p>
                  <p className="text-text-secondary text-sm">
                    Winner: <span className="font-semibold">{auction.winner_team || '—'}</span> at{' '}
                    <span className="text-accent-gold font-bold">₹{((auction.final_price || 0) / 100000).toFixed(1)}L</span>
                  </p>
                </div>
              )}
            </div>

            {/* Bid controls + valuation */}
            <div className="col-span-12 lg:col-span-5 space-y-5">
              {/* Bid buttons */}
              {isActive && (
                <div className="card">
                  <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
                    💰 Place Bid
                  </h2>

                  {/* Current bid display */}
                  <div className="text-center mb-5">
                    <p className="text-text-muted text-xs mb-1">Current Highest Bid</p>
                    <p key={lastBidKey} className="text-4xl font-black text-accent-gold count-up">
                      ₹{(currentBid / 100000).toFixed(1)}L
                    </p>
                    {auction?.current_bidder && (
                      <p className="text-text-muted text-xs mt-1">by {auction.current_bidder}</p>
                    )}
                  </div>

                  {/* Quick increment buttons */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {BID_INCREMENTS.map((inc) => {
                      const bidAmt = currentBid > 0 ? currentBid + inc : basePrice + inc
                      const canAfford = bidAmt <= remainingBudget
                      return (
                        <button
                          id={`bid-btn-${inc / 100000}L`}
                          key={inc}
                          onClick={() => handleQuickBid(inc)}
                          disabled={!canAfford}
                          className={`py-3 rounded-xl font-bold transition-all duration-200 text-sm ${
                            canAfford
                              ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/40 hover:bg-accent-gold hover:text-gray-900 hover:scale-105'
                              : 'bg-surface-2 text-text-muted border border-border-dark cursor-not-allowed'
                          }`}
                        >
                          +₹{(inc / 100000).toFixed(0)}L
                          <span className="block text-xs font-normal opacity-70 mt-0.5">
                            = ₹{(bidAmt / 100000).toFixed(1)}L
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom bid */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">₹</span>
                      <input
                        type="number"
                        placeholder="Custom (L)"
                        value={customBid}
                        onChange={(e) => setCustomBid(e.target.value)}
                        className="input-dark w-full pl-7 pr-12"
                        min={Math.ceil(minNextBid / 100000)}
                        id="custom-bid-input"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">L</span>
                    </div>
                    <button
                      id="custom-bid-btn"
                      onClick={handleCustomBid}
                      disabled={!customBid || parseInt(customBid) * 100000 < minNextBid}
                      className={`px-5 rounded-xl font-bold transition-all duration-200 ${
                        customBid && parseInt(customBid) * 100000 >= minNextBid
                          ? 'bg-accent-gold text-gray-900 hover:bg-yellow-400 hover:scale-105'
                          : 'bg-surface-2 text-text-muted cursor-not-allowed border border-border-dark'
                      }`}
                    >
                      Bid
                    </button>
                  </div>
                  <p className="text-text-muted text-xs mt-2">
                    Min next bid: ₹{(minNextBid / 100000).toFixed(1)}L · Budget left: ₹{(remainingBudget / 100000).toFixed(0)}L
                  </p>
                </div>
              )}

              {/* Valuation spread */}
              {player && (
                <div className="card">
                  <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
                    📈 Valuation Spread
                  </h2>
                  <ValuationSpread
                    basePrice={player.base_price}
                    currentBid={currentBid || player.base_price}
                    fairValue={valuation?.fair_value}
                  />
                  {valuation && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <MiniStat label="Demand" value={`₹${(valuation.demand_component / 100000).toFixed(1)}L`} />
                      <MiniStat label="Skill Bonus" value={`₹${(valuation.skill_bonus / 100000).toFixed(1)}L`} />
                      <MiniStat label="Spread" value={`+${valuation.spread_pct}%`} accent />
                    </div>
                  )}
                </div>
              )}

              {/* Bid velocity */}
              <div className="card">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
                  📊 Bid Velocity
                </h2>
                <BidVelocityChart bids={bids} fairValue={valuation?.fair_value} />
              </div>
            </div>

            {/* Right: Budget + Log */}
            <div className="col-span-12 lg:col-span-3 space-y-5">
              {/* Budget tracker */}
              <div className="card">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">💼 Budget</h2>
                <div className="text-center mb-4">
                  <p className="text-3xl font-black text-accent-gold">₹{(remainingBudget / 100000).toFixed(0)}L</p>
                  <p className="text-text-muted text-xs mt-1">of ₹500L remaining</p>
                </div>
                <div className="h-3 bg-surface-2 rounded-full overflow-hidden border border-border-dark mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      budgetPct > 50 ? 'bg-accent-emerald' : budgetPct > 20 ? 'bg-accent-gold' : 'bg-accent-red'
                    }`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Spent: ₹{(totalSpent / 100000).toFixed(0)}L</span>
                  <span>{budgetPct.toFixed(0)}% left</span>
                </div>

                {/* Competition budget */}
                {teams.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs text-text-muted uppercase tracking-wide font-semibold">Competition</p>
                    {teams.map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <span className="text-text-muted text-xs w-24 truncate">
                          {t.name.split(' ')[0]}
                        </span>
                        <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${t.id === teamId ? 'bg-accent-gold' : 'bg-blue-500/50'}`}
                            style={{ width: `${(t.budget / 50000000) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted w-10 text-right">
                          ₹{(t.budget / 100000).toFixed(0)}L
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Auction log */}
              <div className="card">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">📋 Log</h2>
                <AuctionLog events={events} />
              </div>
            </div>
          </div>
        )}

        {/* ══ ROSTER TAB ══ */}
        {activeTab === 'roster' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="card text-center">
                <p className="text-text-muted text-xs mb-1">Players Signed</p>
                <p className="text-3xl font-black text-text-primary">{myRosterPlayers.length}</p>
              </div>
              <div className="card text-center">
                <p className="text-text-muted text-xs mb-1">Total Spent</p>
                <p className="text-3xl font-black text-accent-red">₹{(totalSpent / 100000).toFixed(0)}L</p>
              </div>
              <div className="card text-center">
                <p className="text-text-muted text-xs mb-1">Remaining</p>
                <p className="text-3xl font-black text-accent-emerald">₹{(remainingBudget / 100000).toFixed(0)}L</p>
              </div>
            </div>

            {myRosterPlayers.length === 0 ? (
              <div className="card text-center py-16">
                <div className="text-5xl mb-4">🏏</div>
                <p className="text-text-muted">No players acquired yet. Start bidding!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {myRosterPlayers.map((p) => (
                  <div key={p.player_id} className="card hover:border-accent-gold/30 transition-all duration-200">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        p.skill_type === 'batting' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        p.skill_type === 'bowling' ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' :
                        'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        {p.skill_type}
                      </span>
                      <span className="text-accent-gold font-black">₹{(p.price_paid / 100000).toFixed(1)}L</span>
                    </div>
                    <h3 className="font-bold text-text-primary mb-1">{p.player_name}</h3>
                    <p className="text-text-muted text-xs">{new Date(p.assigned_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ SYNERGY TAB ══ */}
        {activeTab === 'synergy' && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7">
              <div className="card">
                <h2 className="font-bold text-text-primary mb-1">Team Synergy Graph</h2>
                <p className="text-text-muted text-xs mb-5">
                  Force-directed graph of your roster. Edge thickness = skill complementarity. Dashed nodes = missing roles.
                </p>
                <TeamSynergyGraph players={myRosterPlayers} />
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 space-y-5">
              {/* Skill distribution */}
              <div className="card">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
                  Skill Distribution
                </h2>
                {['batting', 'bowling', 'allrounder'].map((skill) => {
                  const count = myRosterPlayers.filter((p) => p.skill_type === skill).length
                  const ideal = { batting: 5, bowling: 4, allrounder: 2 }[skill]
                  const pct = (count / Math.max(myRosterPlayers.length, 1)) * 100
                  return (
                    <div key={skill} className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="capitalize text-text-secondary font-medium">{skill}</span>
                        <span className="text-text-muted">{count} player{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            skill === 'batting' ? 'bg-blue-500' :
                            skill === 'bowling' ? 'bg-teal-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Rival teams */}
              <div className="card">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
                  Rival Squads
                </h2>
                {Object.entries(allRosters)
                  .filter(([tid]) => tid !== teamId)
                  .map(([tid, data]) => (
                    <div key={tid} className="mb-3 p-3 bg-surface-2 rounded-xl border border-border-dark">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-text-primary text-sm font-semibold">{data.team?.name || tid}</span>
                        <span className="text-text-muted text-xs">{data.players?.length || 0} players</span>
                      </div>
                      <div className="flex gap-1">
                        {(data.players || []).map((p) => (
                          <span
                            key={p.player_id}
                            title={p.player_name}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              p.skill_type === 'batting' ? 'bg-blue-500/30 text-blue-400' :
                              p.skill_type === 'bowling' ? 'bg-teal-500/30 text-teal-400' :
                              'bg-amber-500/30 text-amber-400'
                            }`}
                          >
                            {p.player_name?.charAt(0)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="bg-surface-2 rounded-lg p-2.5 border border-border-dark text-center">
      <p className="text-text-muted text-[10px] mb-0.5">{label}</p>
      <p className={`font-bold text-sm ${accent ? 'text-accent-emerald' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

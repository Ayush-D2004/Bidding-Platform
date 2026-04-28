import { create } from 'zustand'
import axios from 'axios'

const API = 'http://localhost:8000'

const useAuctionStore = create((set, get) => ({
  // Auth
  token: localStorage.getItem('npl_token') || null,
  user: JSON.parse(localStorage.getItem('npl_user') || 'null'),
  
  // Connection
  ws: null,
  connectionStatus: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
  
  // Auction
  currentAuction: null,
  auctionId: null,
  bids: [],
  
  // Team / Roster
  roster: {},
  budget: 50000000,
  teams: [],
  
  // Players
  players: [],
  
  // Copilot
  copilotAnalysis: null,
  copilotLoading: false,
  
  // Notification
  notification: null,

  // ── Auth actions ────────────────────────────────────────────────────────────
  login: async (username, password) => {
    const resp = await axios.post(`${API}/auth/login`, { username, password })
    const { access_token, role, team_id, username: sub } = resp.data
    const user = { sub, role, team_id }
    localStorage.setItem('npl_token', access_token)
    localStorage.setItem('npl_user', JSON.stringify(user))
    set({ token: access_token, user })
    return user
  },

  logout: () => {
    get().disconnect()
    localStorage.removeItem('npl_token')
    localStorage.removeItem('npl_user')
    set({ token: null, user: null, ws: null, connectionStatus: 'disconnected', currentAuction: null, bids: [] })
  },

  // ── WebSocket ───────────────────────────────────────────────────────────────
  connect: (auctionId) => {
    const { token, ws } = get()
    if (!token) return
    
    const actualAuctionId = auctionId || 'global'
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (get().auctionId === actualAuctionId) return // Already connected to this room
      ws.onclose = null
      ws.close()
    }

    set({ connectionStatus: 'connecting', auctionId: actualAuctionId })
    const wsUrl = `ws://localhost:8000/ws/${actualAuctionId}?token=${token}`
    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      set({ connectionStatus: 'connected', ws: socket })
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        get()._handleMessage(msg)
      } catch (e) {
        console.error('[WS] Failed to parse message:', e)
      }
    }

    socket.onerror = (err) => {
      console.error('[WS] Error:', err)
      set({ connectionStatus: 'error' })
    }

    socket.onclose = () => {
      set({ connectionStatus: 'disconnected', ws: null })
    }

    set({ ws: socket })
  },

  disconnect: () => {
    const { ws } = get()
    if (ws) {
      ws.close()
      set({ ws: null, connectionStatus: 'disconnected' })
    }
  },

  _handleMessage: (msg) => {
    const { currentAuction, bids } = get()

    switch (msg.type) {
      case 'AUCTION_STATE_SYNC':
        if (msg.state) {
          set({ currentAuction: msg.state, bids: msg.state.bid_history || [] })
        }
        break

      case 'AUCTION_STARTED':
        set({
          currentAuction: msg.state || { ...msg, status: 'ACTIVE' },
          bids: [],
          copilotAnalysis: null,
        })
        if (msg.auction_id && get().auctionId !== msg.auction_id) {
          // Reconnect to the new auction
          setTimeout(() => {
            get().connect(msg.auction_id)
          }, 100);
        }
        get()._notify('🎤 New auction started!', 'info')
        get().fetchPlayers()
        break

      case 'BID_PLACED': {
        const newBid = {
          managerId: msg.managerId,
          amount: msg.amount,
          timestamp: new Date().toISOString(),
        }
        const updatedBids = [...get().bids, newBid]
        
        // Also update local events list for immediate UI feedback
        const newEvent = {
          id: `local-${Date.now()}`,
          event_type: 'BID_PLACED',
          payload: { managerId: msg.managerId, amount: msg.amount },
          occurred_at: new Date().toISOString()
        }
        const updatedEvents = [...(currentAuction?.events || []), newEvent]

        set({
          bids: updatedBids,
          currentAuction: currentAuction
            ? { ...currentAuction, current_bid: msg.amount, current_bidder: msg.managerId, bid_history: updatedBids, events: updatedEvents }
            : currentAuction,
        })
        get()._notify(`💰 New bid: ₹${(msg.amount / 100000).toFixed(1)}L by ${msg.managerId}`, 'bid')
        break
      }

      case 'AUCTION_CLOSED': {
        const closeEvent = {
          id: `local-${Date.now()}`,
          event_type: 'AUCTION_CLOSED',
          payload: { winner_team: msg.winner_team, final_price: msg.final_price },
          occurred_at: new Date().toISOString()
        }
        const updatedEvents = [...(currentAuction?.events || []), closeEvent]
        
        set({
          currentAuction: currentAuction
            ? { ...currentAuction, status: 'CLOSED', winner_team: msg.winner_team, final_price: msg.final_price, events: updatedEvents }
            : currentAuction,
        })
        get()._notify(`🏆 Auction closed! Winner: ${msg.winner_team} at ₹${(msg.final_price / 100000).toFixed(1)}L`, 'success')
        get().fetchRoster()
        get().fetchPlayers()
        break
      }

      case 'BID_REJECTED':
        get()._notify(`❌ Bid rejected: ${msg.reason || 'No reason given'}`, 'error')
        break

      case 'COPILOT_RESULT':
        set({ copilotAnalysis: msg, copilotLoading: false })
        break

      case 'BID_RESULT':
        if (!msg.success) {
          get()._notify(`❌ Bid failed: ${msg.reason}`, 'error')
        }
        break

      case 'ERROR':
        get()._notify(`⚠️ ${msg.reason}`, 'error')
        break

      case 'PONG':
        break

      default:
        console.log('[WS] Unhandled message:', msg)
    }
  },

  // ── WS actions ──────────────────────────────────────────────────────────────
  placeBid: (amount) => {
    const { ws } = get()
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PLACE_BID', amount }))
    }
  },

  acceptBid: () => {
    const { ws } = get()
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ACCEPT_BID' }))
    }
  },

  rejectBid: (reason = '') => {
    const { ws } = get()
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'REJECT_BID', reason }))
    }
  },

  requestCopilot: () => {
    const { ws } = get()
    if (ws?.readyState === WebSocket.OPEN) {
      set({ copilotLoading: true })
      ws.send(JSON.stringify({ type: 'REQUEST_COPILOT' }))
    }
  },

  // ── REST actions ─────────────────────────────────────────────────────────────
  fetchPlayers: async () => {
    const { token } = get()
    try {
      const resp = await axios.get(`${API}/players`, { headers: { Authorization: `Bearer ${token}` } })
      set({ players: resp.data.players || [] })
      return resp.data.players
    } catch (e) {
      console.error('[Store] fetchPlayers failed:', e)
      return []
    }
  },

  fetchActiveAuction: async () => {
    const { token } = get()
    try {
      const resp = await axios.get(`${API}/auctions/active`, { headers: { Authorization: `Bearer ${token}` } })
      const auction = resp.data.auction
      if (auction) {
        set({ currentAuction: auction, bids: auction.bid_history || [] })
      }
      return auction
    } catch {
      return null
    }
  },

  startAuction: async (playerId) => {
    const { token } = get()
    try {
      const resp = await axios.post(
        `${API}/auctions/start`,
        { player_id: playerId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const { auction_id, state } = resp.data
      set({ currentAuction: state, bids: [], auctionId: auction_id })
      get().connect(auction_id)
      return resp.data
    } catch (e) {
      console.error('[Store] startAuction failed:', e)
      return null
    }
  },

  fetchRoster: async () => {
    const { token, user } = get()
    if (!user?.team_id) return
    try {
      const resp = await axios.get(`${API}/teams/${user.team_id}/roster`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      set({
        roster: resp.data,
        budget: resp.data.remaining_budget,
      })
    } catch (e) {
      console.error('[Store] fetchRoster failed:', e)
    }
  },

  fetchTeams: async () => {
    const { token } = get()
    try {
      const resp = await axios.get(`${API}/teams`, { headers: { Authorization: `Bearer ${token}` } })
      set({ teams: resp.data.teams || [] })
    } catch (e) {
      console.error('[Store] fetchTeams failed:', e)
    }
  },

  fetchAllRosters: async () => {
    const { token, teams } = get()
    const results = {}
    for (const t of teams) {
      try {
        const resp = await axios.get(`${API}/teams/${t.id}/roster`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        results[t.id] = resp.data
      } catch {}
    }
    return results
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  _notify: (message, type = 'info') => {
    set({ notification: { message, type, id: Date.now() } })
    setTimeout(() => {
      set((state) => {
        if (state.notification?.message === message) return { notification: null }
        return {}
      })
    }, 4000)
  },

  clearNotification: () => set({ notification: null }),
}))

// Automatically clear session if backend responds with 401 Unauthorized
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuctionStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

export default useAuctionStore

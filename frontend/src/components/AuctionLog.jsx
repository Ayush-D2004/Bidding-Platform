import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import clsx from 'clsx'

const EVENT_CONFIG = {
  AUCTION_STARTED:  { icon: '🎤', color: 'text-accent-gold',   bg: 'bg-accent-gold/10',   label: 'Auction Started' },
  BID_PLACED:       { icon: '💰', color: 'text-accent-blue',   bg: 'bg-blue-500/10',       label: 'Bid Placed' },
  BID_ACCEPTED:     { icon: '✅', color: 'text-accent-emerald',bg: 'bg-emerald-500/10',    label: 'Bid Accepted' },
  BID_REJECTED:     { icon: '❌', color: 'text-accent-red',    bg: 'bg-red-500/10',        label: 'Bid Rejected' },
  AUCTION_CLOSED:   { icon: '🏆', color: 'text-accent-gold',   bg: 'bg-accent-gold/10',   label: 'Auction Closed' },
  BID_RESULT:       { icon: '📋', color: 'text-text-secondary', bg: 'bg-surface-2',        label: 'Result' },
  AUCTION_STATE_SYNC:{ icon: '🔄', color: 'text-text-muted',   bg: 'bg-surface-2',        label: 'Sync' },
}

function formatPayload(event) {
  const p = event.payload || {}
  const type = event.event_type

  if (type === 'BID_PLACED') {
    const amount = p.amount ? `₹${(p.amount / 100000).toFixed(1)}L` : ''
    return `${p.managerId || 'Team'} → ${amount}`
  }
  if (type === 'AUCTION_STARTED') {
    return `${p.player_name || 'Player'} — Base ₹${((p.base_price || 0) / 100000).toFixed(0)}L`
  }
  if (type === 'BID_ACCEPTED') {
    return `Winner: ${p.winner_team || '-'} at ₹${((p.final_price || 0) / 100000).toFixed(1)}L`
  }
  if (type === 'BID_REJECTED') {
    return p.reason || 'No reason given'
  }
  if (type === 'AUCTION_CLOSED') {
    return p.winner_team ? `Won by ${p.winner_team}` : 'Closed'
  }
  return JSON.stringify(p).slice(0, 80)
}

function EventRow({ event, isNew }) {
  const cfg = EVENT_CONFIG[event.event_type] || {
    icon: '•',
    color: 'text-text-muted',
    bg: 'bg-surface-2',
    label: event.event_type,
  }

  const ts = event.occurred_at
    ? format(new Date(event.occurred_at), 'HH:mm:ss')
    : ''

  return (
    <div className={clsx(
      'flex items-start gap-3 p-3 rounded-xl border border-transparent transition-all duration-300',
      isNew ? 'animate-bid-flash bg-emerald-500/10 border-emerald-500/20' : cfg.bg
    )}>
      <span className="text-lg leading-none mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className={clsx('text-xs font-bold uppercase tracking-wider', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-text-muted font-mono shrink-0">{ts}</span>
        </div>
        <p className="text-text-secondary text-xs leading-snug">{formatPayload(event)}</p>
        {event.sequence != null && (
          <span className="text-[9px] text-text-muted font-mono">#{event.sequence}</span>
        )}
      </div>
    </div>
  )
}

export default function AuctionLog({ events = [] }) {
  const bottomRef = useRef(null)
  const prevLenRef = useRef(0)

  useEffect(() => {
    if (events.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevLenRef.current = events.length
  }, [events.length])

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-text-muted gap-2">
        <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No events yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
      {[...events].reverse().map((event, i) => (
        <EventRow key={event.id ?? `${event.event_type}-${i}`} event={event} isNew={i === 0} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

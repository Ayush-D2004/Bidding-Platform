export default function ValuationSpread({ basePrice, currentBid, fairValue }) {
  if (!basePrice) return null

  const max = Math.max(fairValue || 0, currentBid || 0, basePrice) * 1.15
  const basePct = (basePrice / max) * 100
  const fairPct = fairValue ? (fairValue / max) * 100 : null
  const bidPct = currentBid ? (currentBid / max) * 100 : null

  const spread = fairValue && basePrice
    ? (((fairValue - basePrice) / basePrice) * 100).toFixed(1)
    : null

  const overbid =
    currentBid && fairValue && currentBid > fairValue * 1.1

  return (
    <div className="space-y-3">
      {/* Track */}
      <div className="relative h-8 bg-surface-2 rounded-full overflow-visible border border-border-dark">
        {/* Fill to bid */}
        {bidPct != null && (
          <div
            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
              overbid ? 'bg-accent-red/30' : 'bg-accent-gold/20'
            }`}
            style={{ width: `${Math.min(bidPct, 100)}%` }}
          />
        )}

        {/* Base price marker */}
        <Marker pct={basePct} color="#6b7280" label={`₹${(basePrice / 100000).toFixed(0)}L`} labelPos="below" />

        {/* Fair value marker */}
        {fairPct != null && (
          <Marker pct={fairPct} color="#10b981" label={`₹${(fairValue / 100000).toFixed(1)}L`} labelPos="above" />
        )}

        {/* Current bid marker */}
        {bidPct != null && (
          <Marker pct={bidPct} color={overbid ? '#ef4444' : '#f59e0b'} label={`₹${(currentBid / 100000).toFixed(1)}L`} labelPos="below" />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <LegendItem color="#6b7280" label="Base Price" value={`₹${(basePrice / 100000).toFixed(0)}L`} />
        {fairValue && (
          <LegendItem color="#10b981" label="Fair Value" value={`₹${(fairValue / 100000).toFixed(1)}L`} />
        )}
        {currentBid && (
          <LegendItem
            color={overbid ? '#ef4444' : '#f59e0b'}
            label="Current Bid"
            value={`₹${(currentBid / 100000).toFixed(1)}L`}
          />
        )}
        {spread && (
          <div className="ml-auto flex items-center gap-1 text-text-secondary">
            <span>Spread:</span>
            <span className={`font-bold ${parseFloat(spread) > 0 ? 'text-accent-emerald' : 'text-accent-red'}`}>
              +{spread}%
            </span>
          </div>
        )}
      </div>

      {overbid && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-accent-red">
          <span>⚠</span>
          <span>Bid is more than 10% above fair value — potential overpay risk</span>
        </div>
      )}
    </div>
  )
}

function Marker({ pct, color, label, labelPos }) {
  const safeLeft = Math.max(2, Math.min(pct, 97))
  return (
    <div className="absolute top-0 h-full" style={{ left: `${safeLeft}%` }}>
      <div className="relative h-full flex items-center">
        <div className="w-0.5 h-full" style={{ background: color }} />
        <div
          className={`absolute left-1 whitespace-nowrap text-[10px] font-bold ${
            labelPos === 'above' ? 'bottom-full pb-1' : 'top-full pt-1'
          }`}
          style={{ color }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

function LegendItem({ color, label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-text-muted">{label}:</span>
      <span className="font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}

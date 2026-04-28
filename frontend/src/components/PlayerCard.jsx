import clsx from 'clsx'

const SKILL_LABELS = { batting: 'Batter', bowling: 'Bowler', allrounder: 'All-Rounder' }

export default function PlayerCard({ player, currentBid, fairValue, compact = false }) {
  if (!player) return null

  const { name, skill_type, bat_strength, bowl_strength, base_price, status } = player
  const primaryStat = skill_type === 'bowling' ? bowl_strength : bat_strength
  const statLabel = skill_type === 'bowling' ? 'Bowl' : 'Bat'
  const secondaryStat = skill_type === 'bowling' ? bat_strength : bowl_strength
  const secondaryLabel = skill_type === 'bowling' ? 'Bat' : 'Bowl'

  const skillBadgeClass = clsx(
    'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border',
    {
      'bg-blue-500/20 text-blue-400 border-blue-500/30': skill_type === 'batting',
      'bg-teal-500/20 text-teal-400 border-teal-500/30': skill_type === 'bowling',
      'bg-amber-500/20 text-amber-400 border-amber-500/30': skill_type === 'allrounder',
    }
  )

  const statusColor = {
    AVAILABLE: 'text-emerald-400',
    ON_AUCTION: 'text-accent-gold',
    SOLD: 'text-text-muted',
  }[status] || 'text-text-muted'

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border-dark">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black', {
          'bg-blue-500/20': skill_type === 'batting',
          'bg-teal-500/20': skill_type === 'bowling',
          'bg-amber-500/20': skill_type === 'allrounder',
        })}>
          {name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text-primary text-sm truncate">{name}</div>
          <div className={skillBadgeClass + ' inline-block mt-0.5'}>{SKILL_LABELS[skill_type]}</div>
        </div>
        <div className="text-right">
          <div className="text-accent-gold font-bold text-sm">₹{(base_price / 100000).toFixed(0)}L</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border-dark bg-surface animate-slide-up">
      {/* Skill-themed gradient banner */}
      <div className={clsx('h-2 w-full', {
        'bg-gradient-to-r from-blue-500 to-blue-700': skill_type === 'batting',
        'bg-gradient-to-r from-teal-500 to-teal-700': skill_type === 'bowling',
        'bg-gradient-to-r from-amber-500 to-orange-600': skill_type === 'allrounder',
      })} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={skillBadgeClass}>{SKILL_LABELS[skill_type]}</span>
              {status && (
                <span className={clsx('text-xs font-medium', statusColor)}>
                  {status === 'ON_AUCTION' ? '● On Auction' : status === 'SOLD' ? '● Sold' : ''}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-text-primary leading-tight">{name}</h2>
          </div>
          <div className={clsx('w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg', {
            'bg-blue-500/20 text-blue-400': skill_type === 'batting',
            'bg-teal-500/20 text-teal-400': skill_type === 'bowling',
            'bg-amber-500/20 text-amber-400': skill_type === 'allrounder',
          })}>
            {name.charAt(0)}
          </div>
        </div>

        {/* Skill bars */}
        <div className="space-y-3 mb-5">
          <SkillBar label={statLabel} value={primaryStat} skillType={skill_type} primary />
          <SkillBar label={secondaryLabel} value={secondaryStat} skillType={skill_type} />
        </div>

        {/* Price row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="stat-card">
            <div className="text-text-muted text-xs mb-1">Base Price</div>
            <div className="text-text-primary font-bold text-lg">₹{(base_price / 100000).toFixed(0)}L</div>
          </div>
          {currentBid != null && (
            <div className="stat-card border-accent-gold/30 bg-accent-gold/5">
              <div className="text-text-muted text-xs mb-1">Current Bid</div>
              <div className="text-accent-gold font-bold text-lg count-up">
                ₹{(currentBid / 100000).toFixed(1)}L
              </div>
            </div>
          )}
          {fairValue != null && (
            <div className="stat-card border-accent-emerald/30 bg-accent-emerald/5 col-span-2">
              <div className="text-text-muted text-xs mb-1">AI Fair Value</div>
              <div className="text-accent-emerald font-bold text-lg">
                ₹{(fairValue / 100000).toFixed(1)}L
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SkillBar({ label, value, skillType, primary }) {
  const colors = {
    batting: { bar: 'bg-blue-500', bg: 'bg-blue-500/10' },
    bowling: { bar: 'bg-teal-500', bg: 'bg-teal-500/10' },
    allrounder: { bar: 'bg-amber-500', bg: 'bg-amber-500/10' },
  }
  const c = colors[skillType] || colors.batting

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-text-muted text-xs font-medium">{label}</span>
        <span className={clsx('text-xs font-bold', primary ? 'text-text-primary' : 'text-text-secondary')}>
          {value}/100
        </span>
      </div>
      <div className={clsx('h-2 rounded-full overflow-hidden', c.bg)}>
        <div
          className={clsx('h-full rounded-full transition-all duration-700', c.bar)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

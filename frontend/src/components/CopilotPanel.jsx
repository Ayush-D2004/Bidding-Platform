import clsx from 'clsx'

const VERDICT_CONFIG = {
  UNDERVALUED: {
    icon: '📈',
    label: 'Undervalued',
    class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    glow: 'shadow-emerald-500/20',
    rec: 'ACCEPT',
  },
  FAIR_VALUE: {
    icon: '⚖️',
    label: 'Fair Value',
    class: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    glow: 'shadow-blue-500/20',
    rec: 'HOLD',
  },
  OVERVALUED: {
    icon: '📉',
    label: 'Overvalued',
    class: 'bg-red-500/20 text-red-400 border-red-500/40',
    glow: 'shadow-red-500/20',
    rec: 'REJECT',
  },
}

const REC_CONFIG = {
  ACCEPT: { icon: '✅', class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  HOLD:   { icon: '⏸️', class: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  REJECT: { icon: '❌', class: 'bg-red-500/20 text-red-400 border-red-500/40' },
}

export default function CopilotPanel({ analysis, loading, onRequest }) {
  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-accent-gold/20 animate-ping" />
          <div className="absolute inset-0 rounded-full border-2 border-t-accent-gold animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-lg">🤖</div>
        </div>
        <p className="text-text-muted text-sm animate-pulse">Gemini is analysing…</p>
      </div>
    )
  }

  // Empty state — request button
  if (!analysis) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-14 h-14 rounded-2xl bg-accent-gold/10 border border-accent-gold/30 flex items-center justify-center text-2xl">
          🤖
        </div>
        <div className="text-center">
          <p className="text-text-primary font-semibold mb-1">AI Copilot</p>
          <p className="text-text-muted text-sm">Get an instant verdict on the current bid vs. fair value.</p>
        </div>
        {onRequest && (
          <button onClick={onRequest} className="btn-primary flex items-center gap-2">
            <span>✨</span>
            <span>Analyse Current Bid</span>
          </button>
        )}
      </div>
    )
  }

  const { verdict, confidence, reasoning, recommendation } = analysis
  const vCfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.FAIR_VALUE
  const rCfg = REC_CONFIG[recommendation] || REC_CONFIG.HOLD

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Verdict badge */}
      <div className={clsx('inline-flex items-center gap-2 px-4 py-2 rounded-2xl border font-bold text-lg shadow-xl', vCfg.class, vCfg.glow)}>
        <span>{vCfg.icon}</span>
        <span>{vCfg.label}</span>
      </div>

      {/* Confidence meter */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-text-muted">Confidence</span>
          <span className="font-semibold text-text-primary">{Math.round(confidence * 100)}%</span>
        </div>
        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-700', {
              'bg-emerald-500': confidence > 0.8,
              'bg-accent-gold': confidence > 0.6 && confidence <= 0.8,
              'bg-accent-red': confidence <= 0.6,
            })}
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Reasoning */}
      <div className="bg-surface-2 rounded-xl p-4 border border-border-dark">
        <p className="text-text-secondary text-sm leading-relaxed">{reasoning}</p>
      </div>

      {/* Recommendation */}
      <div className="flex items-center gap-3">
        <span className="text-text-muted text-sm">Recommendation:</span>
        <span className={clsx('flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-bold', rCfg.class)}>
          <span>{rCfg.icon}</span>
          <span>{recommendation}</span>
        </span>
      </div>

      {/* Re-analyse */}
      {onRequest && (
        <button
          onClick={onRequest}
          className="w-full btn-ghost text-sm"
        >
          🔄 Re-analyse
        </button>
      )}
    </div>
  )
}

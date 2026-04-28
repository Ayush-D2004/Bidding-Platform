import { motion } from 'framer-motion'
import clsx from 'clsx'

export default function Leaderboard({ teams = [] }) {
  const sortedTeams = [...teams].sort((a, b) => b.budget - a.budget)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">
        <div className="col-span-1">#</div>
        <div className="col-span-5">Team</div>
        <div className="col-span-3 text-right">Budget Left</div>
        <div className="col-span-3 text-right">Roster</div>
      </div>

      <div className="space-y-2">
        {sortedTeams.map((team, i) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="grid grid-cols-12 items-center bg-surface-2 border border-border-dark rounded-2xl px-6 py-4 hover:border-accent-gold/40 transition-colors group"
          >
            <div className="col-span-1 font-black text-text-muted group-hover:text-accent-gold transition-colors">
              {i + 1}
            </div>
            
            <div className="col-span-5 flex items-center gap-3">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner', {
                'bg-blue-500/20 text-blue-400': team.id === 'team-1',
                'bg-purple-500/20 text-purple-400': team.id === 'team-2',
                'bg-emerald-500/20 text-emerald-400': team.id === 'team-3',
                'bg-yellow-500/20 text-yellow-500': team.id === 'team-4',
              })}>
                {team.name.charAt(0)}
              </div>
              <div className="font-bold text-text-primary text-sm">{team.name}</div>
            </div>

            <div className="col-span-3 text-right">
              <div className="text-text-primary font-black">₹{(team.budget / 100000).toFixed(1)}L</div>
              <div className="h-1.5 w-full bg-bg-dark rounded-full mt-2 overflow-hidden">
                <div 
                  className={clsx('h-full rounded-full transition-all duration-1000', {
                    'bg-accent-emerald': team.budget > 25000000,
                    'bg-accent-gold': team.budget <= 25000000 && team.budget > 10000000,
                    'bg-accent-red': team.budget <= 10000000,
                  })}
                  style={{ width: `${(team.budget / 50000000) * 100}%` }}
                />
              </div>
            </div>

            <div className="col-span-3 text-right">
              <span className="bg-surface border border-border-dark px-3 py-1 rounded-lg text-xs font-bold text-text-secondary">
                {team.player_count || 0} / 11
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

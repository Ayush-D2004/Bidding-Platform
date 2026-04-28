import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const SKILL_COLORS = {
  batting: '#3b82f6',
  bowling: '#14b8a6',
  allrounder: '#f59e0b',
}

const MISSING_ROLES = [
  { id: '__missing_bat', name: '?', skill_type: 'batting', missing: true },
  { id: '__missing_bowl', name: '?', skill_type: 'bowling', missing: true },
  { id: '__missing_ar', name: '?', skill_type: 'allrounder', missing: true },
]

function getSkillWeight(a, b) {
  if (a === b) return 0.3
  if ((a === 'batting' && b === 'bowling') || (a === 'bowling' && b === 'batting')) return 0.9
  if (a === 'allrounder' || b === 'allrounder') return 0.7
  return 0.5
}

export default function TeamSynergyGraph({ players = [] }) {
  const svgRef = useRef(null)

  // Determine which roles are missing
  const hasRole = (r) => players.some((p) => p.skill_type === r)
  const missingNodes = MISSING_ROLES.filter((m) => !hasRole(m.skill_type.split('_')[0]))

  const allNodes = [
    ...players.map((p) => ({ ...p, missing: false })),
    ...missingNodes,
  ]

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = svgRef.current?.parentElement
    const W = container?.clientWidth || 360
    const H = 280

    svg.attr('width', W).attr('height', H)

    const nodes = allNodes.map((p) => ({ ...p }))
    const links = []

    // Build edges
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const w = getSkillWeight(nodes[i].skill_type, nodes[j].skill_type)
        if (w >= 0.5) {
          links.push({ source: i, target: j, weight: w })
        }
      }
    }

    const sim = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d, i) => i).distance((l) => 100 - l.weight * 40).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(35))

    // Gradient defs
    const defs = svg.append('defs')
    const glow = defs.append('filter').attr('id', 'glow')
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const feMerge = glow.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Draw links
    const link = svg
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-width', (d) => d.weight * 2)
      .attr('stroke-dasharray', (d) => (d.weight < 0.6 ? '4,4' : 'none'))

    // Draw node groups
    const node = svg
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag()
          .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )

    // Circles
    node
      .append('circle')
      .attr('r', 20)
      .attr('fill', (d) => d.missing ? 'transparent' : `${SKILL_COLORS[d.skill_type]}22`)
      .attr('stroke', (d) => d.missing ? '#374151' : SKILL_COLORS[d.skill_type])
      .attr('stroke-width', (d) => d.missing ? 1.5 : 2)
      .attr('stroke-dasharray', (d) => d.missing ? '4,3' : 'none')
      .attr('filter', (d) => d.missing ? 'none' : 'url(#glow)')

    // Initials text
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('font-weight', '700')
      .attr('font-family', 'Inter')
      .attr('fill', (d) => d.missing ? '#374151' : SKILL_COLORS[d.skill_type])
      .text((d) => d.missing ? '?' : d.name.charAt(0))

    // Name labels
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '2.4em')
      .attr('font-size', '9px')
      .attr('font-family', 'Inter')
      .attr('fill', (d) => d.missing ? '#374151' : '#9ca3af')
      .text((d) => d.missing ? `Need ${d.skill_type.slice(0,3)}` : d.name.split(' ')[0])

    sim.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => sim.stop()
  }, [players.length])

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-text-muted gap-2">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm">No players yet — acquire some!</p>
      </div>
    )
  }

  return (
    <div className="w-full relative">
      <svg ref={svgRef} className="w-full" />
      <div className="flex gap-3 mt-3 flex-wrap">
        {Object.entries(SKILL_COLORS).map(([skill, color]) => (
          <div key={skill} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-text-muted text-xs capitalize">{skill}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-gray-600 border-dashed" />
          <span className="text-text-muted text-xs">Missing role</span>
        </div>
      </div>
    </div>
  )
}

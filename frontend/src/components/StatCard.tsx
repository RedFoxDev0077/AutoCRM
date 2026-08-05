import type { LucideIcon } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  label: string
  value: number | string
  icon: LucideIcon
  sub?: string
  trend?: number         // positive = up, negative = down
  sparkData?: number[]
  color?: 'teal' | 'blue' | 'green' | 'purple' | 'orange' | 'rose'
}

const palette = {
  teal:   { bg: 'bg-teal-50',   icon: 'bg-teal-100 text-teal-600',   stroke: '#14B8A6', fill: '#14B8A6' },
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   stroke: '#3B82F6', fill: '#3B82F6' },
  green:  { bg: 'bg-emerald-50',icon: 'bg-emerald-100 text-emerald-600', stroke: '#10B981', fill: '#10B981' },
  purple: { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', stroke: '#8B5CF6', fill: '#8B5CF6' },
  orange: { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600',  stroke: '#F59E0B', fill: '#F59E0B' },
  rose:   { bg: 'bg-rose-50',   icon: 'bg-rose-100 text-rose-600',    stroke: '#F43F5E', fill: '#F43F5E' },
}

export default function StatCard({ label, value, icon: Icon, sub, trend, sparkData, color = 'teal' }: Props) {
  const c = palette[color]
  const gradId = `spark-${color}`
  const chartData = (sparkData ?? [4, 6, 5, 8, 7, 9, 11]).map(v => ({ v }))
  const up = trend !== undefined ? trend >= 0 : true

  return (
    <div className={`${c.bg} rounded-2xl border border-white/60 p-5 flex flex-col gap-3 overflow-hidden relative`}>
      {/* Top row: icon + trend */}
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center`}>
          <Icon size={18} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {up ? '+' : ''}{trend}%
          </span>
        )}
      </div>

      {/* Value + label */}
      <div>
        <p className="text-2xl font-bold text-slate-800 tabular-nums leading-none">{value}</p>
        <p className="text-sm text-slate-500 mt-1 font-medium">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>

      {/* Sparkline */}
      <div className="h-12 -mx-2 -mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={c.stroke} stopOpacity={0.25} />
                <stop offset="95%" stopColor={c.stroke} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={c.stroke}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

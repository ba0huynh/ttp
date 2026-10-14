import * as React from 'react'

const TONES = {
  jade: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200/70',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/70',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200/70',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200/70',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200/70',
} as const

/** KPI tile: neutral card, coloured only in the icon chip so numbers stay the focus */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = 'jade',
}: {
  label: string
  value: React.ReactNode
  unit?: string
  hint?: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  tone?: keyof typeof TONES
}) {
  return (
    <div className="rounded-xl border bg-card shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span
          className={`size-8 shrink-0 rounded-lg ring-1 flex items-center justify-center ${TONES[tone]}`}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="tabular text-[26px] leading-none font-bold tracking-tight text-slate-900">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-medium text-slate-500">
            {unit}
          </span>
        )}
      </div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

/** Standard page heading: title, one-line context, actions on the right */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="space-y-1 min-w-0">
        {eyebrow && (
          <div className="text-xs font-medium text-emerald-700">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-500 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Activity, ChevronDown, ExternalLink, Layers3 } from 'lucide-react'
import { formatSource } from '@/lib/jobs'
import { cn, formatDate } from '@/lib/utils'
import type { DiscoveryLifecycleStatus, JobScoreSummary, JobSourceSummary } from '@/types/discovery'

interface EvidencePayload {
  job: {
    lifecycle_status: DiscoveryLifecycleStatus
    preferred_source: string | null
    source_count: number
    first_seen_at: string | null
    last_seen_at: string | null
    last_verified_at: string | null
    closed_at: string | null
    salary_min: number | null
    salary_max: number | null
    salary_currency: string | null
    employment_type: string | null
    seniority: string | null
    remote_type: string | null
    description_changed_at: string | null
  }
  sources: JobSourceSummary[]
  scores: JobScoreSummary[]
}

const lifecycleTone: Record<DiscoveryLifecycleStatus, string> = {
  open: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  unverified: 'bg-amber-50 text-amber-800 ring-amber-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
  expired: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const dimensionLabels: Array<[keyof JobScoreSummary, string]> = [
  ['title_score', 'Title'],
  ['responsibility_score', 'Responsibilities'],
  ['experience_score', 'Experience'],
  ['industry_score', 'Industry'],
  ['seniority_score', 'Seniority'],
  ['location_score', 'Location'],
  ['compensation_score', 'Compensation'],
  ['freshness_score', 'Freshness'],
  ['company_priority_score', 'Company'],
  ['source_quality_score', 'Source'],
]

function salaryLabel(job: EvidencePayload['job']) {
  if (job.salary_min == null && job.salary_max == null) return null
  const formatter = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: job.salary_currency ?? 'CAD',
    maximumFractionDigits: 0,
  })
  if (job.salary_min != null && job.salary_max != null) {
    return `${formatter.format(job.salary_min)}–${formatter.format(job.salary_max)}`
  }
  return formatter.format(job.salary_min ?? job.salary_max ?? 0)
}

export function JobDiscoveryEvidence({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [payload, setPayload] = useState<EvidencePayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || payload || pending) return

    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/jobs/${jobId}/discovery`, { cache: 'no-store' })
      const result = await response.json() as EvidencePayload & { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Discovery evidence could not be loaded.')
      setPayload(result)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Discovery evidence could not be loaded.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <span className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-brand-700" aria-hidden="true" />
          Discovery evidence
        </span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-200 p-3">
          {pending ? <p className="text-xs text-slate-500">Loading source and score evidence…</p> : null}
          {error ? <p className="text-xs font-medium text-rose-700" role="alert">{error}</p> : null}
          {payload ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('badge ring-1 ring-inset', lifecycleTone[payload.job.lifecycle_status])}>
                  {payload.job.lifecycle_status}
                </span>
                <span className="badge bg-white text-slate-600 ring-1 ring-inset ring-slate-200">
                  {payload.job.source_count} source{payload.job.source_count === 1 ? '' : 's'}
                </span>
                {payload.job.preferred_source ? (
                  <span className="badge bg-white text-slate-600 ring-1 ring-inset ring-slate-200">
                    Preferred: {formatSource(payload.job.preferred_source)}
                  </span>
                ) : null}
                {salaryLabel(payload.job) ? (
                  <span className="badge bg-white text-slate-600 ring-1 ring-inset ring-slate-200">
                    {salaryLabel(payload.job)}
                  </span>
                ) : null}
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div><dt className="text-slate-400">First seen</dt><dd>{payload.job.first_seen_at ? formatDate(payload.job.first_seen_at) : 'Unknown'}</dd></div>
                <div><dt className="text-slate-400">Last verified</dt><dd>{payload.job.last_verified_at ? formatDate(payload.job.last_verified_at) : 'Not verified'}</dd></div>
                <div><dt className="text-slate-400">Employment</dt><dd>{payload.job.employment_type ?? 'Not specified'}</dd></div>
                <div><dt className="text-slate-400">Seniority</dt><dd>{payload.job.seniority ?? 'Not specified'}</dd></div>
              </dl>

              {payload.scores.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Activity className="h-4 w-4 text-brand-700" aria-hidden="true" />
                    Search-lane scores
                  </div>
                  {payload.scores.slice(0, 3).map((score) => (
                    <div key={`${score.search_profile_id}-${score.overall_score}`} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{score.profile_name}</p>
                          {score.hard_disqualified ? <p className="mt-1 text-xs text-rose-700">Hard rule: {score.disqualifiers[0] ?? 'Disqualified'}</p> : null}
                        </div>
                        <span className="text-lg font-semibold tabular-nums text-slate-950">{Math.round(score.overall_score)}%</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                        {dimensionLabels.map(([key, label]) => (
                          <div key={String(key)}>
                            <div className="flex justify-between text-[11px] text-slate-500"><span>{label}</span><span>{Math.round(Number(score[key] ?? 0))}</span></div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.max(0, Math.min(100, Number(score[key] ?? 0)))}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-500">No profile-specific scores have been recorded yet.</p>}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">Source observations</p>
                {payload.sources.map((source) => (
                  <div key={source.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{formatSource(source.source)}</span>
                        {source.is_primary ? <span className="badge bg-emerald-50 text-emerald-700">Primary</span> : null}
                        <span className={cn('badge ring-1 ring-inset', lifecycleTone[source.lifecycle_status])}>{source.lifecycle_status}</span>
                      </div>
                      <p className="mt-1 text-slate-500">Verified {formatDate(source.last_verified_at)}</p>
                    </div>
                    {source.apply_url || source.source_url ? (
                      <a href={source.apply_url ?? source.source_url ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Open ${formatSource(source.source)} source`}>
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

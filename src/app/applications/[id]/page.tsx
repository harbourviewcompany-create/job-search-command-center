import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { ApplicationDetailActions } from '@/components/ApplicationDetailActions'
import { NotesForm } from '@/components/NotesForm'
import { GeneratePackageButton } from '@/components/GeneratePackageButton'
import { OutreachPanel } from '@/components/OutreachPanel'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: app } = await supabase
    .from('applications')
    .select('*, jobs(*, companies(*))')
    .eq('id', id)
    .single()

  if (!app) notFound()

  const job = app.jobs as any
  const hasPackage = Boolean(app.resume_version_id || app.cover_note)

  let storedResume: string | null = null
  let storedDocxUrl: string | null = null
  if (app.resume_version_id) {
    const { data: version } = await supabase
      .from('resume_versions')
      .select('content, docx_url')
      .eq('id', app.resume_version_id)
      .maybeSingle()
    storedResume = version?.content ?? null
    storedDocxUrl = version?.docx_url ?? null
  }

  const companyId = job.company_id as string | null
  const { data: contacts } = companyId
    ? await supabase
        .from('contacts')
        .select('id, name, title')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] as { id: string; name: string; title: string | null }[] }

  const { data: outreach } = await supabase
    .from('outreach_messages')
    .select('id, type, draft_body, status, sent_at, created_at')
    .eq('application_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/applications"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to pipeline
      </Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{job.title}</h1>
            <p className="mt-1 text-slate-500">
              {job.companies?.name ?? 'Unknown company'}
              {job.location ? ` · ${job.location}` : ''}
              {job.remote ? ' · Remote' : ''}
            </p>
            {job.fit_score != null && (
              <p className="mt-2 text-sm">
                <span className="badge bg-brand-50 text-brand-700">
                  Fit {job.fit_score}/100
                </span>
                {Array.isArray(job.fit_reasons) && job.fit_reasons.length > 0 && (
                  <span className="ml-2 text-xs text-slate-500">
                    {job.fit_reasons.slice(0, 2).join(' · ')}
                  </span>
                )}
              </p>
            )}
          </div>
          <span className="badge bg-brand-50 text-brand-700 capitalize">
            {app.status}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">Source</dt>
            <dd className="mt-0.5 font-medium capitalize">{job.source}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Applied</dt>
            <dd className="mt-0.5 font-medium">{formatDate(app.applied_at)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Updated</dt>
            <dd className="mt-0.5 font-medium">{formatDate(app.updated_at)}</dd>
          </div>
        </dl>

        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary mt-4 inline-flex"
          >
            Open original listing <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        <div className="mt-6">
          <ApplicationDetailActions
            applicationId={app.id}
            currentStatus={app.status}
            hasPackage={hasPackage}
          />
        </div>
      </div>

      <section className="card p-6">
        <h2 className="font-medium">Tailored package</h2>
        <p className="mt-1 text-sm text-slate-500">
          One click builds a resume and cover note weighted to this job, plus a
          downloadable .docx when Storage is configured. Review before marking
          Applied (required).
          {process.env.ANTHROPIC_API_KEY
            ? ' AI polish is enabled.'
            : ' Using fast keyword tailoring (set ANTHROPIC_API_KEY for LLM polish).'}
        </p>
        <div className="mt-4">
          <GeneratePackageButton
            applicationId={app.id}
            hasPackage={hasPackage}
            initialDocxUrl={storedDocxUrl}
          />
        </div>
        {!hasPackage && (
          <p className="mt-3 text-xs text-amber-700">
            Generate a package before you can mark this application as Applied.
          </p>
        )}
        {(storedResume || app.cover_note) && (
          <div className="mt-4 space-y-3">
            {app.cover_note && (
              <div>
                <h3 className="text-sm font-medium">Saved cover note</h3>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">
                  {app.cover_note}
                </pre>
              </div>
            )}
            {storedResume && (
              <div>
                <h3 className="text-sm font-medium">Saved resume</h3>
                <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">
                  {storedResume}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="font-medium">Outreach</h2>
        <p className="mt-1 text-sm text-slate-500">
          Draft LinkedIn/email messages. Copy and send yourself — nothing is
          auto-sent. Log contacts on the Contacts page first for personalization.
        </p>
        <div className="mt-4">
          <OutreachPanel
            applicationId={app.id}
            companyName={job.companies?.name ?? null}
            jobTitle={job.title}
            contacts={contacts ?? []}
            messages={outreach ?? []}
          />
        </div>
      </section>

      {job.description && (
        <section className="card p-6">
          <h2 className="font-medium">Job description</h2>
          <div className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
            {job.description}
          </div>
        </section>
      )}

      <section className="card p-6">
        <h2 className="font-medium">Notes</h2>
        <NotesForm applicationId={app.id} initialNotes={app.notes ?? ''} />
      </section>
    </div>
  )
}

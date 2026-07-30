'use client'

import { useState, useTransition } from 'react'
import {
  createOutreachDraft,
  markOutreachSent,
} from '@/app/contacts/actions'
import type { OutreachTemplateKey } from '@/lib/outreach'
import { Copy, Check, Send } from 'lucide-react'

interface ContactOption {
  id: string
  name: string
  title: string | null
}

interface ExistingMessage {
  id: string
  type: string
  draft_body: string | null
  status: string
  sent_at: string | null
  created_at: string
}

interface Props {
  applicationId: string
  companyName: string | null
  jobTitle: string
  contacts: ContactOption[]
  messages: ExistingMessage[]
}

const TEMPLATES: { key: OutreachTemplateKey; label: string }[] = [
  { key: 'after_apply', label: 'After applying' },
  { key: 'cold_hiring', label: 'Cold / hiring manager' },
  { key: 'warm', label: 'Warm network' },
  { key: 'semi_warm', label: 'Semi-warm' },
  { key: 'recruiter', label: 'Recruiter' },
  { key: 'follow_up_1', label: 'Follow-up' },
]

export function OutreachPanel({
  applicationId,
  companyName,
  jobTitle,
  contacts,
  messages,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [template, setTemplate] = useState<OutreachTemplateKey>('after_apply')
  const [contactId, setContactId] = useState<string>('')
  const [latest, setLatest] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function generate() {
    setError(null)
    startTransition(async () => {
      try {
        const row = await createOutreachDraft({
          applicationId,
          contactId: contactId || null,
          template,
          companyName,
          jobTitle,
          contactName: contacts.find((c) => c.id === contactId)?.name,
        })
        setLatest(row.draft_body)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Draft failed')
      }
    })
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="text-slate-500">Template</span>
          <select
            className="input mt-1"
            value={template}
            onChange={(e) => setTemplate(e.target.value as OutreachTemplateKey)}
          >
            {TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Contact (optional)</span>
          <select
            className="input mt-1 min-w-[12rem]"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">— None —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.title ? ` · ${c.title}` : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={generate}
          >
            {pending ? 'Drafting…' : 'Draft outreach'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {latest && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => copy(latest)}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-xs text-slate-700">{latest}</pre>
          <p className="mt-2 text-xs text-slate-500">
            Copy into LinkedIn or email. Mark sent below after you send — we never
            auto-send.
          </p>
        </div>
      )}

      {messages.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {messages.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium capitalize text-slate-500">
                  {m.type.replace(/_/g, ' ')} · {m.status}
                </p>
                {m.status === 'drafted' && (
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() =>
                      startTransition(() =>
                        markOutreachSent(m.id, applicationId)
                      )
                    }
                  >
                    <Send className="h-3.5 w-3.5" /> Mark sent
                  </button>
                )}
              </div>
              {m.draft_body && (
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-slate-600">
                  {m.draft_body}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

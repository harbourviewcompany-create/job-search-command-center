'use client'

import { useState, useTransition } from 'react'
import { generatePackage } from '@/app/applications/package-actions'
import { FileText, Copy, Check } from 'lucide-react'

interface Props {
  applicationId: string
  hasPackage: boolean
}

export function GeneratePackageButton({ applicationId, hasPackage }: Props) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{
    resumeMarkdown: string
    coverNote: string
  } | null>(null)
  const [copied, setCopied] = useState<'resume' | 'cover' | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  function handleGenerate() {
    startTransition(async () => {
      const pkg = await generatePackage(applicationId)
      setResult(pkg)
    })
  }

  async function copy(text: string, which: 'resume' | 'cover') {
    try {
      await navigator.clipboard.writeText(text)
      setCopyError(null)
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopyError('Copy failed — select and copy the text manually.')
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={pending}
        className="btn-primary"
      >
        <FileText className="h-4 w-4" />
        {pending
          ? 'Generating…'
          : hasPackage || result
            ? 'Regenerate tailored package'
            : 'Generate tailored package'}
      </button>

      {copyError && <p className="text-xs text-red-600">{copyError}</p>}

      {result && (
        <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">Cover note</h3>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => copy(result.coverNote, 'cover')}
              >
                {copied === 'cover' ? (
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
            <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">
              {result.coverNote}
            </pre>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">Tailored resume</h3>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => copy(result.resumeMarkdown, 'resume')}
              >
                {copied === 'resume' ? (
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
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">
              {result.resumeMarkdown}
            </pre>
          </div>
          <p className="text-xs text-slate-500">
            Copy into your doc or LinkedIn Easy Apply. Mark Applied on the
            pipeline when you submit.
          </p>
        </div>
      )}
    </div>
  )
}

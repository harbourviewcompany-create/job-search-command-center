'use client'

import { useState, useTransition } from 'react'
import { addCompanyAndContact } from '@/app/contacts/actions'

export function AddContactForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setDone(false)
    const fd = new FormData(e.currentTarget)
    const companyName = String(fd.get('companyName') || '').trim()
    const name = String(fd.get('name') || '').trim()
    if (!companyName || !name) {
      setError('Company and name are required.')
      return
    }
    startTransition(async () => {
      try {
        await addCompanyAndContact({
          companyName,
          name,
          title: String(fd.get('title') || '') || undefined,
          email: String(fd.get('email') || '') || undefined,
          linkedinUrl: String(fd.get('linkedinUrl') || '') || undefined,
        })
        setDone(true)
        e.currentTarget.reset()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add contact')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-5">
      <h2 className="font-medium">Add contact</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-500">Company</span>
          <input name="companyName" className="input mt-1" required />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Name</span>
          <input name="name" className="input mt-1" required />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Title</span>
          <input name="title" className="input mt-1" />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Email</span>
          <input name="email" type="email" className="input mt-1" />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-500">LinkedIn URL</span>
          <input name="linkedinUrl" className="input mt-1" placeholder="https://linkedin.com/in/..." />
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {done && <p className="text-xs text-emerald-600">Contact saved.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Saving…' : 'Save contact'}
      </button>
    </form>
  )
}

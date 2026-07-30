import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { AddContactForm } from '@/components/AddContactForm'

export const dynamic = 'force-dynamic'

export default async function ContactsPage() {
  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, companies(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Decision-makers and recruiters. Add manually, or use Apollo lookup when
          APOLLO_API_KEY is configured. Draft outreach from any application.
        </p>
      </div>

      <AddContactForm />

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(contacts ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  No contacts yet. Add one above or import via Apollo.
                </td>
              </tr>
            )}
            {(contacts ?? []).map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50/50">
                <td className="px-5 py-3 font-medium">
                  {c.linkedin_url ? (
                    <a
                      href={c.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      {c.name}
                    </a>
                  ) : (
                    c.name
                  )}
                </td>
                <td className="px-5 py-3 text-slate-600">{c.title ?? '—'}</td>
                <td className="px-5 py-3 text-slate-600">
                  {c.companies?.name ?? '—'}
                </td>
                <td className="px-5 py-3">
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      className="text-brand-600 hover:underline"
                    >
                      {c.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-5 py-3 text-slate-400 capitalize">
                  {c.source ?? '—'}
                </td>
                <td className="px-5 py-3 text-slate-400">
                  {formatDate(c.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
